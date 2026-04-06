"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Development,
  Block,
  ManagingAgent,
  Freeholder,
  DevelopmentLink,
  ConfidenceLevel,
  IssueStatus,
  IssueCategory,
} from "../lib/database.types";

// ─── helpers ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  facilities: "🏢", maintenance: "🔧", service_charge: "💷", security: "🔒",
  safety: "⚠️", communal_areas: "🏠", communication: "📢", other: "📋",
};

const AGENT_CATS = ["responsiveness", "communication", "value_for_money", "maintenance", "transparency"] as const;
const AGENT_LABELS: Record<string, string> = {
  responsiveness: "Responsiveness", communication: "Communication",
  value_for_money: "Value for Money", maintenance: "Maintenance", transparency: "Transparency",
};
const FH_CATS = ["building_investment", "leaseholder_relations", "transparency", "accountability"] as const;
const FH_LABELS: Record<string, string> = {
  building_investment: "Building Investment", leaseholder_relations: "Leaseholder Relations",
  transparency: "Transparency", accountability: "Accountability",
};

function confidenceBadge(level: ConfidenceLevel) {
  const s: Record<ConfidenceLevel, string> = {
    confirmed: "bg-green-900/60 text-green-400", high: "bg-indigo-900/60 text-indigo-300",
    medium: "bg-amber-900/60 text-amber-400", low: "bg-red-900/60 text-red-400",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${s[level]}`}>{level}</span>;
}

function statusBadge(status: IssueStatus) {
  const s: Record<IssueStatus, string> = {
    new: "bg-indigo-900/60 text-indigo-300", acknowledged: "bg-amber-900/60 text-amber-400",
    in_progress: "bg-blue-900/60 text-blue-300", resolved: "bg-green-900/60 text-green-400",
    escalated: "bg-red-900/60 text-red-400 ring-1 ring-red-500/40",
  };
  const l: Record<IssueStatus, string> = {
    new: "New", acknowledged: "Acknowledged", in_progress: "In Progress",
    resolved: "Resolved", escalated: "Escalated",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${s[status]}`}>{l[status]}</span>;
}

function ratingColor(score: number) {
  if (score >= 4) return "text-green-400";
  if (score >= 2.5) return "text-amber-400";
  return "text-red-400";
}

function ratingBarColor(score: number) {
  if (score >= 4) return "bg-green-400";
  if (score >= 2.5) return "bg-amber-400";
  return "bg-red-400";
}

// ─── types ──────────────────────────────────────────────────────────────────

interface LinkRow extends DevelopmentLink {
  managing_agents: ManagingAgent | null;
  freeholders: Freeholder | null;
}

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  status: IssueStatus;
  created_at: string;
  raised_by: string;
  block_id: string | null;
  supporter_count: number;
  user_supported: boolean;
  agent_response: string | null;
  agent_responded_at: string | null;
  agent_name: string | null;
}

type AgentRating = Record<(typeof AGENT_CATS)[number], number> & { id?: string; comment?: string };
type FhRating = Record<(typeof FH_CATS)[number], number> & { id?: string; comment?: string };

// ─── page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();

  // auth & profile
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userStatus, setUserStatus] = useState<"owner" | "tenant">("owner");
  const [userBlockId, setUserBlockId] = useState<string | null>(null);
  const [userBuildingId, setUserBuildingId] = useState("");
  const [userBlockName, setUserBlockName] = useState("");
  const [userFlat, setUserFlat] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("unverified");

  // development data
  const [dev, setDev] = useState<Development | null>(null);
  const [link, setLink] = useState<LinkRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  // issues
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [filterBlock, setFilterBlock] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [newIssue, setNewIssue] = useState({ title: "", description: "", category: "maintenance" as string, block_id: "" });
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<Record<string, { first_name: string; last_name: string }[]>>({});

  // ratings
  const [allAgentRatings, setAllAgentRatings] = useState<any[]>([]);
  const [allFhRatings, setAllFhRatings] = useState<any[]>([]);
  const [myAgentRating, setMyAgentRating] = useState<AgentRating | null>(null);
  const [myFhRating, setMyFhRating] = useState<FhRating | null>(null);
  const [agentForm, setAgentForm] = useState<Record<string, number>>({});
  const [fhForm, setFhForm] = useState<Record<string, number>>({});
  const [agentComment, setAgentComment] = useState("");
  const [fhComment, setFhComment] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showFhDetails, setShowFhDetails] = useState(false);
  const [showAgentRating, setShowAgentRating] = useState(false);
  const [showFhRating, setShowFhRating] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  // tabs
  const [activeTab, setActiveTab] = useState("overview");

  // corrections
  const [showCorrection, setShowCorrection] = useState(false);
  const [corrField, setCorrField] = useState("");
  const [corrValue, setCorrValue] = useState("");
  const [submittingCorr, setSubmittingCorr] = useState(false);
  const [corrSuccess, setCorrSuccess] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  // ─── data loading ───────────────────────────────────────────────────────

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      // profile → building → development
      const { data: profile } = await supabase
        .from("profiles")
        .select("building_id, flat_number, status, first_name, last_name, block_id, verification_status")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      setUserName(`${profile.first_name} ${profile.last_name}`);
      setUserStatus(profile.status === "tenant" ? "tenant" : "owner");
      setUserBlockId(profile.block_id || null);
      setUserBuildingId(profile.building_id || "");
      setUserFlat(profile.flat_number || "");
      setVerificationStatus(profile.verification_status || "unverified");

      const { data: building } = await supabase
        .from("buildings")
        .select("id, name, total_flats, development_name")
        .eq("id", profile.building_id)
        .single();
      if (!building?.development_name) return;
      setUserBlockName(building.name || "");

      // find development by name
      const { data: devData } = await supabase
        .from("developments")
        .select("*")
        .eq("name", building.development_name)
        .single();
      if (!devData) return;
      setDev(devData);

      // development_links with agent + freeholder
      const { data: linkData } = await supabase
        .from("development_links")
        .select("*, managing_agents(*), freeholders(*)")
        .eq("development_id", devData.id)
        .single();
      if (linkData) setLink(linkData as LinkRow);

      // blocks
      const { data: blockData } = await supabase
        .from("blocks")
        .select("*")
        .eq("development_id", devData.id)
        .order("name");
      if (blockData) setBlocks(blockData);

      // member count (profiles in buildings with same development_name)
      const { data: devBuildings } = await supabase
        .from("buildings")
        .select("id")
        .eq("development_name", building.development_name);
      if (devBuildings && devBuildings.length > 0) {
        const bIds = devBuildings.map(b => b.id);
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .in("building_id", bIds);
        setMemberCount(count || 0);
      }

      // issues
      await loadIssues(devData.id, user.id);

      // ratings
      await loadRatings(devData.id, user.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadIssues(devId: string, uid: string) {
    const { data: issueData } = await supabase
      .from("issues")
      .select("id, title, description, category, status, created_at, raised_by, block_id")
      .eq("development_id", devId)
      .order("created_at", { ascending: false });

    if (!issueData) return;

    const withSupport = await Promise.all(
      issueData.map(async (issue) => {
        const { count: sc } = await supabase
          .from("issue_supporters")
          .select("*", { count: "exact", head: true })
          .eq("issue_id", issue.id);
        const { data: userSup } = await supabase
          .from("issue_supporters")
          .select("id")
          .eq("issue_id", issue.id)
          .eq("user_id", uid)
          .limit(1);

        // Fetch the latest agent response for this issue (if any)
        const { data: respData } = await supabase
          .from("agent_responses")
          .select("response_text, created_at, agent_token_id")
          .eq("issue_id", issue.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let agent_response: string | null = null;
        let agent_responded_at: string | null = null;
        let agent_name: string | null = null;

        if (respData && respData.length > 0) {
          agent_response = respData[0].response_text;
          agent_responded_at = respData[0].created_at;
          // Look up the agent name via the token
          const { data: tokenRow } = await supabase
            .from("agent_tokens")
            .select("managing_agent_id")
            .eq("id", respData[0].agent_token_id)
            .single();
          if (tokenRow?.managing_agent_id) {
            const { data: agentRow } = await supabase
              .from("managing_agents")
              .select("name")
              .eq("id", tokenRow.managing_agent_id)
              .single();
            agent_name = agentRow?.name || null;
          }
        }

        return {
          ...issue,
          supporter_count: (sc || 0) + 1,
          user_supported: (userSup && userSup.length > 0) || issue.raised_by === uid,
          agent_response,
          agent_responded_at,
          agent_name,
        } as IssueRow;
      })
    );
    setIssues(withSupport);
  }

  async function loadRatings(devId: string, uid: string) {
    const { data: ar } = await supabase.from("agent_ratings").select("*").eq("development_id", devId);
    const { data: fr } = await supabase.from("freeholder_ratings").select("*").eq("development_id", devId);
    setAllAgentRatings(ar || []);
    setAllFhRatings(fr || []);

    const myAR = ar?.find((r: any) => r.user_id === uid);
    if (myAR) {
      setMyAgentRating(myAR);
      setAgentForm(Object.fromEntries(AGENT_CATS.map(c => [c, myAR[c]])));
      setAgentComment(myAR.comment || "");
    }
    const myFR = fr?.find((r: any) => r.user_id === uid);
    if (myFR) {
      setMyFhRating(myFR);
      setFhForm(Object.fromEntries(FH_CATS.map(c => [c, myFR[c]])));
      setFhComment(myFR.comment || "");
    }
  }

  // ─── actions ────────────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function toggleSupport(issueId: string, supported: boolean) {
    if (supported) {
      await supabase.from("issue_supporters").delete().eq("issue_id", issueId).eq("user_id", userId);
    } else {
      await supabase.from("issue_supporters").insert({ issue_id: issueId, user_id: userId });
    }
    if (dev) await loadIssues(dev.id, userId);
  }

  async function loadSupporters(issueId: string) {
    const { data } = await supabase
      .from("issue_supporters")
      .select("user_id")
      .eq("issue_id", issueId);
    if (!data) return;
    const names: { first_name: string; last_name: string }[] = [];
    for (const s of data) {
      const { data: p } = await supabase.from("profiles").select("first_name, last_name").eq("id", s.user_id).single();
      if (p) names.push(p);
    }
    setSupporters(prev => ({ ...prev, [issueId]: names }));
  }

  async function submitIssue() {
    if (!newIssue.title.trim() || !dev) return;
    setSubmittingIssue(true);
    try {
      const { data: inserted } = await supabase.from("issues").insert({
        development_id: dev.id,
        block_id: newIssue.block_id || null,
        raised_by: userId,
        title: newIssue.title,
        description: newIssue.description || null,
        category: newIssue.category,
      }).select("id").single();

      // Issue alert emails — disabled for now until we add proper filtering
      // (e.g. daily digest, category preferences, frequency caps)
      // if (inserted?.id) {
      //   fetch("/api/email/new-issue", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({ issueId: inserted.id, developmentId: dev.id, reporterId: userId }),
      //   }).catch(() => {});
      // }

      setNewIssue({ title: "", description: "", category: "maintenance", block_id: "" });
      setIsAnonymous(false);
      setShowIssueForm(false);
      await loadIssues(dev.id, userId);
    } catch (err) { console.error(err); }
    finally { setSubmittingIssue(false); }
  }

  async function submitAgentRating() {
    if (!dev) return;
    const allFilled = AGENT_CATS.every(c => agentForm[c] >= 1 && agentForm[c] <= 5);
    if (!allFilled) return;
    setSubmittingRating(true);
    const payload = {
      development_id: dev.id, user_id: userId,
      ...Object.fromEntries(AGENT_CATS.map(c => [c, agentForm[c]])),
      comment: agentComment || null, updated_at: new Date().toISOString(),
    };
    if (myAgentRating?.id) {
      await supabase.from("agent_ratings").update(payload).eq("id", myAgentRating.id);
    } else {
      await supabase.from("agent_ratings").insert(payload);
    }
    setShowAgentRating(false);
    await loadRatings(dev.id, userId);
    setSubmittingRating(false);
  }

  async function submitFhRating() {
    if (!dev) return;
    const allFilled = FH_CATS.every(c => fhForm[c] >= 1 && fhForm[c] <= 5);
    if (!allFilled) return;
    setSubmittingRating(true);
    const payload = {
      development_id: dev.id, user_id: userId,
      ...Object.fromEntries(FH_CATS.map(c => [c, fhForm[c]])),
      comment: fhComment || null, updated_at: new Date().toISOString(),
    };
    if (myFhRating?.id) {
      await supabase.from("freeholder_ratings").update(payload).eq("id", myFhRating.id);
    } else {
      await supabase.from("freeholder_ratings").insert(payload);
    }
    setShowFhRating(false);
    await loadRatings(dev.id, userId);
    setSubmittingRating(false);
  }

  async function submitCorrection() {
    if (!corrField || !corrValue.trim() || !dev) return;
    setSubmittingCorr(true);
    await supabase.from("corrections").insert({
      development_id: dev.id,
      submitted_by: userId,
      field: corrField,
      current_value: getCurrentValue(corrField),
      suggested_value: corrValue.trim(),
    });
    setShowCorrection(false);
    setCorrField("");
    setCorrValue("");
    setCorrSuccess(true);
    setTimeout(() => setCorrSuccess(false), 4000);
    setSubmittingCorr(false);
  }

  function getCurrentValue(field: string): string {
    const agent = link?.managing_agents;
    const fh = link?.freeholders;
    switch (field) {
      case "managing_agent": return agent?.name || "";
      case "freeholder": return fh?.name || "";
      case "freeholder_parent": return fh?.parent_company || "";
      case "agent_phone": return agent?.phone || "";
      case "agent_email": return agent?.email || "";
      case "total_units": return String(dev?.total_units || "");
      case "developer": return dev?.developer || "";
      default: return "";
    }
  }

  // ─── aggregate calculations ─────────────────────────────────────────────

  function calcAggregate(ratings: any[], cats: readonly string[]) {
    if (ratings.length < 3) return null;
    const result: Record<string, number> = {};
    for (const c of cats) {
      result[c] = ratings.reduce((sum: number, r: any) => sum + r[c], 0) / ratings.length;
    }
    result.overall = cats.reduce((sum, c) => sum + result[c], 0) / cats.length;
    return result;
  }

  const agentAgg = calcAggregate(allAgentRatings, AGENT_CATS);
  const fhAgg = calcAggregate(allFhRatings, FH_CATS);

  // ─── filtered issues ───────────────────────────────────────────────────

  const filtered = issues.filter(i => {
    if (filterBlock && i.block_id !== filterBlock) return false;
    if (filterCategory && i.category !== filterCategory) return false;
    return true;
  });

  // ─── issue counts per block ─────────────────────────────────────────────

  const issuesByBlock: Record<string, number> = {};
  issues.forEach(i => { if (i.block_id) issuesByBlock[i.block_id] = (issuesByBlock[i.block_id] || 0) + 1; });

  // ─── loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex items-center justify-center">
        <p className="text-[rgba(255,255,255,0.55)]">Loading your dashboard…</p>
      </div>
    );
  }

  if (!dev) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white">
        <nav className="sticky top-0 z-50 flex justify-between items-center px-6 md:px-8 py-3.5 border-b border-[#1e3a5f]" style={{ background: "#0f1f3d" }}>
          <Link href="/dashboard" className="text-lg font-extrabold text-[#1ec6a4]">BlockVoice</Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[rgba(255,255,255,0.55)]">{userName}</span>
            <button onClick={handleLogout} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white">Log out</button>
          </div>
        </nav>
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <span className="text-4xl mb-4 block">🏗️</span>
          <h1 className="text-2xl font-extrabold text-white mb-3">We&apos;re setting up your building</h1>
          <p className="text-[rgba(255,255,255,0.55)] mb-6 leading-relaxed">
            Thanks for signing up! We&apos;re currently sourcing the details for your development — managing agent, freeholder, and building information. We&apos;ll notify you as soon as your dashboard is ready.
          </p>
          <div className="bg-[#132847] rounded-xl p-5 border border-[#1e3a5f] text-left mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.3)] mb-2">What happens next</h3>
            <ul className="space-y-2 text-sm text-[rgba(255,255,255,0.55)]">
              <li className="flex gap-2"><span className="text-[#1ec6a4]">✓</span> Your signup has been recorded</li>
              <li className="flex gap-2"><span className="text-amber-400">◻</span> We&apos;re verifying your development details</li>
              <li className="flex gap-2"><span className="text-[rgba(255,255,255,0.2)]">◻</span> Your full dashboard will appear once confirmed</li>
            </ul>
          </div>
          <p className="text-xs text-[rgba(255,255,255,0.3)]">This usually takes 1–2 working days. If you think this is an error, email hello@blockvoice.co.uk</p>
        </div>
      </div>
    );
  }

  const agent = link?.managing_agents ?? null;
  const freeholder = link?.freeholders ?? null;
  const pct = dev.total_units > 0 ? Math.round((memberCount / dev.total_units) * 100) : 0;

  const CORRECTION_FIELDS = [
    { value: "managing_agent", label: "Managing Agent" },
    { value: "freeholder", label: "Freeholder" },
    { value: "freeholder_parent", label: "Freeholder Parent Company" },
    { value: "agent_phone", label: "Agent Phone" },
    { value: "agent_email", label: "Agent Email" },
    { value: "total_units", label: "Total Units" },
    { value: "developer", label: "Developer" },
    { value: "other", label: "Other" },
  ];

  const categories: IssueCategory[] = ["facilities", "maintenance", "service_charge", "security", "safety", "communal_areas", "communication", "other"];

  // ─── render ─────────────────────────────────────────────────────────────

  // Computed
  const agentAvg = agentAgg?.overall ?? null;
  const fhAvg = fhAgg?.overall ?? null;

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white" style={{ fontSize: 14 }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex justify-between items-center px-[6%] h-12" style={{ background: "#0f1f3d", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/dashboard" className="font-extrabold text-[15px] text-[#1ec6a4]">BlockVoice</Link>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-[rgba(255,255,255,0.35)]">{userName}</span>
          <span className="text-[rgba(255,255,255,0.12)]">·</span>
          <button onClick={handleLogout} className="text-[rgba(255,255,255,0.3)] hover:text-white">Sign Out</button>
        </div>
      </nav>

      <div className="max-w-[820px] mx-auto px-6 py-5">

        {/* ── Page Header ── */}
        <div className="mb-1">
          <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-tight">{dev.name}</h1>
          <div className="flex items-center gap-[6px] flex-wrap text-[12px] text-[rgba(255,255,255,0.3)] mt-1">
            <span>{dev.postcodes?.[0]}</span><span className="w-[3px] h-[3px] rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span>{dev.total_units} units</span><span className="w-[3px] h-[3px] rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span>{userBlockName}</span><span className="w-[3px] h-[3px] rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span>Flat {userFlat}</span><span className="w-[3px] h-[3px] rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span className="capitalize">{userStatus}</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-[rgba(255,255,255,0.06)] mt-3 mb-5">
          {[
            { id: "overview", label: "Overview" },
            { id: "charges", label: "Service Charges", badge: "BETA" },
            { id: "documents", label: "Documents" },
            { id: "settings", label: "Settings" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-all ${activeTab === t.id ? "text-[#1ec6a4] border-[#1ec6a4]" : "text-[rgba(255,255,255,0.3)] border-transparent hover:text-[rgba(255,255,255,0.5)]"}`}>
              {t.label}
              {t.badge && <span className="ml-1 text-[9px] font-bold px-[5px] py-[1px] rounded-full bg-[#fbbf24] text-[#412402]">{t.badge}</span>}
              {t.id === "issues" && issues.length > 0 && <span className="ml-1 text-[10px] bg-[rgba(30,198,164,0.15)] text-[#1ec6a4] px-[5px] py-[1px] rounded-full">{issues.length}</span>}
            </button>
          ))}
        </div>

        {/* ════════════════════ OVERVIEW TAB ════════════════════ */}
        {activeTab === "overview" && (
          <div>

        {/* ── Verification Banner ── */}
        {verificationStatus !== "verified" && (
          <Link href="/verify" className="flex items-center justify-between bg-[#132847] border border-amber-900/30 rounded-lg px-4 py-2.5 hover:border-[#1ec6a4]/30 transition-colors mb-5">
            <div className="flex items-center gap-2">
              <span className="text-base">{verificationStatus === "pending" ? "⏳" : "🔒"}</span>
              <div>
                <p className="text-[12px] font-semibold">{verificationStatus === "pending" ? "Verification in progress" : "Verify your identity"}</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.3)]">{verificationStatus === "pending" ? "We're reviewing your documents" : "Verified residents carry more weight"}</p>
              </div>
            </div>
            <span className="text-[11px] text-[#1ec6a4]">→</span>
          </Link>
        )}

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-[#132847] rounded-lg p-3 text-center"><div className="text-[18px] font-extrabold tracking-[-0.5px]">{memberCount}</div><div className="text-[9px] uppercase text-[rgba(255,255,255,0.3)] tracking-[0.5px]">Apartments</div></div>
          <div className="bg-[#132847] rounded-lg p-3 text-center"><div className="text-[18px] font-extrabold tracking-[-0.5px]">{issues.length}</div><div className="text-[9px] uppercase text-[rgba(255,255,255,0.3)] tracking-[0.5px]">Issues</div></div>
          <div className="bg-[#132847] rounded-lg p-3 text-center"><div className="text-[18px] font-extrabold tracking-[-0.5px]">{"—"}</div><div className="text-[9px] uppercase text-[rgba(255,255,255,0.3)] tracking-[0.5px]">£/sqft</div></div>
          <div className="bg-[#132847] rounded-lg p-3 text-center"><div className={`text-[18px] font-extrabold tracking-[-0.5px] ${agentAvg ? (agentAvg >= 3 ? "text-green-400" : "text-amber-400") : ""}`}>{agentAvg ? `★ ${agentAvg.toFixed(1)}` : "—"}</div><div className="text-[9px] uppercase text-[rgba(255,255,255,0.3)] tracking-[0.5px]">Agent</div></div>
        </div>

        {/* ── Progress ── */}
        <div className="mb-5">
          <div className="flex justify-between text-[11px] text-[rgba(255,255,255,0.3)] mb-1">
            <span>{memberCount} of ~{dev.total_units} apartments signed up</span><span>{pct}%</span>
          </div>
          <div className="h-[3px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            <div className="h-[3px] bg-[#1ec6a4] rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
        </div>

        {/* ── Building Details (Notion-style props) ── */}
        <div className="mb-5">
          <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)] mb-2">Building details</div>
          <div className="space-y-0">
            {/* Agent */}
            <div className="flex items-center py-[5px] text-[13px] hover:bg-[rgba(255,255,255,0.02)] rounded px-1">
              <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Managing agent</span>
              <div className="flex items-center gap-[6px]">
                <strong>{agent?.name || "Unknown"}</strong>
                {link && confidenceBadge(link.agent_confidence)}
                {agentAvg && <><span className="text-[12px] text-amber-400">{"★".repeat(Math.round(agentAvg))}</span><span className="text-[11px] text-[rgba(255,255,255,0.3)]">{agentAvg.toFixed(1)}</span></>}
              </div>
            </div>
            {agent?.phone && (
              <div className="flex items-center py-[5px] text-[13px] px-1">
                <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Agent phone</span>
                <a href={`tel:${agent.phone}`} className="text-[#1ec6a4]">{agent.phone}</a>
              </div>
            )}
            {agent?.email && (
              <div className="flex items-center py-[5px] text-[13px] px-1">
                <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Agent email</span>
                <a href={`mailto:${agent.email}`} className="text-[#1ec6a4]">{agent.email}</a>
              </div>
            )}
            {/* Freeholder */}
            <div className="flex items-center py-[5px] text-[13px] hover:bg-[rgba(255,255,255,0.02)] rounded px-1">
              <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Freeholder</span>
              <div className="flex items-center gap-[6px]">
                <strong>{freeholder?.name || "Unknown"}</strong>
                {link && confidenceBadge(link.freeholder_confidence)}
              </div>
            </div>
            {freeholder?.parent_company && (
              <div className="flex items-center py-[5px] text-[13px] px-1">
                <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Parent company</span>
                <span>{freeholder.parent_company}</span>
              </div>
            )}
            {dev.developer && (
              <div className="flex items-center py-[5px] text-[13px] px-1">
                <span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Developer</span>
                <span>{dev.developer}</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Blocks ── */}
        {blocks.length > 0 && (
          <div className="mb-5">
            <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)] mb-2">Blocks</div>
            <div className="flex flex-wrap gap-[6px]">
              {blocks.map(b => (
                <span key={b.id} className={`text-[11px] py-[5px] px-[10px] rounded-md border ${b.id === userBlockId ? "bg-[rgba(30,198,164,0.08)] border-[rgba(30,198,164,0.2)] text-[#1ec6a4]" : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)]"}`}>
                  {b.name}{b.total_units > 0 && <span className="text-[10px] text-[rgba(255,255,255,0.25)] ml-1">· {b.total_units}</span>}
                  {issuesByBlock[b.id] && <span className="ml-1 text-[9px] text-amber-400">({issuesByBlock[b.id]})</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Open Issues ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)]">Open issues</div>
            <button onClick={() => setShowIssueForm(!showIssueForm)} className="text-[11px] font-semibold text-[#1ec6a4] hover:underline">+ Report issue</button>
          </div>

          {/* Issue form */}
          {showIssueForm && (
            <div className="bg-[#132847] rounded-lg border border-[#1e3a5f] p-4 mb-3 space-y-3">
              <input type="text" placeholder="What's the issue?" value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[13px] text-white outline-none" />
              <textarea placeholder="Describe the issue (optional)" value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})} rows={2}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[13px] text-white outline-none resize-none" />
              <div className="flex gap-2">
                <select value={newIssue.category} onChange={e => setNewIssue({...newIssue, category: e.target.value})}
                  className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none">
                  {categories.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
                {blocks.length > 0 && (
                  <select value={newIssue.block_id} onChange={e => setNewIssue({...newIssue, block_id: e.target.value})}
                    className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none">
                    <option value="">All blocks</option>
                    {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[11px] text-[rgba(255,255,255,0.4)] cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="rounded" /> Report anonymously
                </label>
                <button onClick={submitIssue} disabled={!newIssue.title.trim() || submittingIssue}
                  className="bg-[#1ec6a4] text-white font-bold text-[12px] px-4 py-2 rounded-lg disabled:opacity-40">
                  {submittingIssue ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* Issue list */}
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[rgba(255,255,255,0.25)] py-2">No open issues. Be the first to report one.</p>
          ) : (
            filtered.map(issue => (
              <div key={issue.id}>
                <div className="flex items-center gap-[10px] py-2 px-[6px] rounded-md hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
                  onClick={() => { setExpandedIssue(expandedIssue === issue.id ? null : issue.id); if (!supporters[issue.id]) loadSupporters(issue.id); }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.status === "resolved" ? "bg-green-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{issue.title}</div>
                    <div className="text-[10px] text-[rgba(255,255,255,0.25)] mt-[1px]">
                      {issue.category.replace(/_/g, " ")} · {new Date(issue.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {blocks.find(b => b.id === issue.block_id)?.name && ` · ${blocks.find(b => b.id === issue.block_id)?.name}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {issue.agent_response && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded-full"
                        style={{ background: "rgba(30,198,164,0.15)", color: "#1ec6a4", border: "1px solid rgba(30,198,164,0.3)" }}>
                        💬 Replied
                      </span>
                    )}
                    <span className="text-[11px] text-[rgba(255,255,255,0.3)]">{issue.supporter_count}</span>
                    <button onClick={e => { e.stopPropagation(); toggleSupport(issue.id, issue.user_supported); }}
                      className={`text-[10px] font-bold px-2 py-[3px] rounded-[5px] ${issue.user_supported ? "bg-[rgba(30,198,164,0.15)] text-[#1ec6a4] border border-[#1ec6a4]" : "bg-[rgba(30,198,164,0.08)] text-[#1ec6a4] border border-[rgba(30,198,164,0.15)]"}`}>
                      {issue.user_supported ? "Supported" : "Support"}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {expandedIssue === issue.id && (
                  <div className="ml-[18px] mb-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {issue.description && (
                      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{issue.description}</p>
                    )}
                    {supporters[issue.id] && supporters[issue.id].length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] uppercase font-semibold tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Supported by
                        </p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {supporters[issue.id].map(s => `${s.first_name} ${s.last_name?.charAt(0) || ""}.`).join(", ")}
                        </p>
                      </div>
                    )}
                    {issue.agent_response ? (
                      <div className="rounded-lg p-3" style={{ background: "rgba(30,198,164,0.06)", border: "1px solid rgba(30,198,164,0.18)" }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "#1ec6a4" }}>
                            Response from {issue.agent_name || "Managing Agent"}
                          </span>
                          {issue.agent_responded_at && (
                            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                              {new Date(issue.agent_responded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                          {issue.agent_response}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] italic" style={{ color: "rgba(255,255,255,0.25)" }}>
                        No response from the managing agent yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Invite ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between p-[14px] rounded-[10px] bg-[rgba(30,198,164,0.06)] border border-[rgba(30,198,164,0.15)]">
            <div>
              <strong>{memberCount} apartments joined</strong> — help us reach 50
              <p className="text-[12px] text-[rgba(255,255,255,0.4)] mt-[2px]">More residents = stronger data, louder voice</p>
            </div>
            <button onClick={() => setInviteOpen(!inviteOpen)} className="bg-[#1ec6a4] text-[#0f1f3d] font-bold text-[12px] px-4 py-[7px] rounded-lg flex-shrink-0">
              Invite neighbours
            </button>
          </div>
          {inviteOpen && (
            <div className="bg-[#132847] rounded-lg border border-[#1e3a5f] p-4 mt-2 space-y-3">
              <div className="flex items-center gap-2">
                <input readOnly value={`blockvoice.co.uk/join/${dev.slug}`} className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-[rgba(255,255,255,0.6)] outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(`https://blockvoice.co.uk/join/${dev.slug}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                  className="bg-[#1ec6a4] text-[#0f1f3d] font-bold text-[11px] px-3 py-2 rounded-lg flex-shrink-0">
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="flex gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(`Hey! I've joined BlockVoice for ${dev.name}. Join here: https://blockvoice.co.uk/join/${dev.slug}`)}`}
                  target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[12px] font-bold text-green-400 border border-green-400/30 rounded-lg py-2">WhatsApp</a>
                <a href={`mailto:?subject=Join ${dev.name} on BlockVoice&body=Hey, I've joined BlockVoice for ${dev.name}. Join here: https://blockvoice.co.uk/join/${dev.slug}`}
                  className="flex-1 text-center text-[12px] font-bold text-blue-400 border border-blue-400/30 rounded-lg py-2">Email</a>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Rate ── */}
        <div className="mb-5">
          <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)] mb-2">Rate your building management</div>
          <div className="flex gap-[10px]">
            <button onClick={() => setShowAgentRating(!showAgentRating)}
              className="flex-1 text-center text-[12px] font-bold text-[#1ec6a4] bg-[rgba(30,198,164,0.08)] border border-[rgba(30,198,164,0.15)] rounded-lg py-2 hover:bg-[rgba(30,198,164,0.12)]">
              ★ Rate {agent?.name || "Agent"}
            </button>
            <button onClick={() => setShowFhRating(!showFhRating)}
              className="flex-1 text-center text-[12px] font-bold text-[#1ec6a4] bg-[rgba(30,198,164,0.08)] border border-[rgba(30,198,164,0.15)] rounded-lg py-2 hover:bg-[rgba(30,198,164,0.12)]">
              ★ Rate {freeholder?.name || "Freeholder"}
            </button>
          </div>

          {/* Agent rating form */}
          {showAgentRating && (
            <div className="bg-[#132847] rounded-lg border border-[#1e3a5f] p-4 mt-2 space-y-3">
              <p className="text-[12px] font-semibold">Rate {agent?.name} (1-5 for each)</p>
              {AGENT_CATS.map(c => (
                <div key={c} className="flex items-center justify-between">
                  <span className="text-[12px] text-[rgba(255,255,255,0.5)]">{AGENT_LABELS[c]}</span>
                  <div className="flex gap-1">{[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setAgentForm({...agentForm, [c]: n})}
                      className={`w-7 h-7 rounded text-[12px] font-bold ${agentForm[c] === n ? "bg-[#1ec6a4] text-white" : "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)]"}`}>{n}</button>
                  ))}</div>
                </div>
              ))}
              <textarea placeholder="Any comments? (optional)" value={agentComment} onChange={e => setAgentComment(e.target.value)} rows={2}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none resize-none" />
              <button onClick={submitAgentRating} disabled={submittingRating}
                className="w-full bg-[#1ec6a4] text-white font-bold text-[12px] py-2 rounded-lg disabled:opacity-40">
                {submittingRating ? "Submitting..." : myAgentRating ? "Update Rating" : "Submit Rating"}
              </button>
            </div>
          )}

          {/* Freeholder rating form */}
          {showFhRating && (
            <div className="bg-[#132847] rounded-lg border border-[#1e3a5f] p-4 mt-2 space-y-3">
              <p className="text-[12px] font-semibold">Rate {freeholder?.name} (1-5 for each)</p>
              {FH_CATS.map(c => (
                <div key={c} className="flex items-center justify-between">
                  <span className="text-[12px] text-[rgba(255,255,255,0.5)]">{FH_LABELS[c]}</span>
                  <div className="flex gap-1">{[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setFhForm({...fhForm, [c]: n})}
                      className={`w-7 h-7 rounded text-[12px] font-bold ${fhForm[c] === n ? "bg-[#1ec6a4] text-white" : "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)]"}`}>{n}</button>
                  ))}</div>
                </div>
              ))}
              <textarea placeholder="Any comments? (optional)" value={fhComment} onChange={e => setFhComment(e.target.value)} rows={2}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none resize-none" />
              <button onClick={submitFhRating} disabled={submittingRating}
                className="w-full bg-[#1ec6a4] text-white font-bold text-[12px] py-2 rounded-lg disabled:opacity-40">
                {submittingRating ? "Submitting..." : myFhRating ? "Update Rating" : "Submit Rating"}
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Corrections ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)]">Something wrong?</div>
            <button onClick={() => setShowCorrection(!showCorrection)} className="text-[11px] font-semibold text-[#1ec6a4] hover:underline">Suggest correction</button>
          </div>
          {corrSuccess && <p className="text-[12px] text-green-400 mb-2">Correction submitted — thank you!</p>}
          {showCorrection && (
            <div className="bg-[#132847] rounded-lg border border-[#1e3a5f] p-4 space-y-3">
              <select value={corrField} onChange={e => setCorrField(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none">
                <option value="">What needs correcting?</option>
                {CORRECTION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              {corrField && (
                <>
                  {corrField !== "other" && getCurrentValue(corrField) && (
                    <p className="text-[11px] text-[rgba(255,255,255,0.35)]">Current: {getCurrentValue(corrField)}</p>
                  )}
                  <input type="text" placeholder="What should it be?" value={corrValue} onChange={e => setCorrValue(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] text-white outline-none" />
                  <button onClick={submitCorrection} disabled={submittingCorr}
                    className="w-full bg-[#1ec6a4] text-white font-bold text-[12px] py-2 rounded-lg disabled:opacity-40">
                    {submittingCorr ? "Submitting..." : "Submit Correction"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)] my-5" />

        {/* ── Feedback ── */}
        <div className="mb-5">
          <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)] mb-2">Feedback</div>
          {feedbackSent ? (
            <p className="text-[12px] text-green-400">Thanks for your feedback!</p>
          ) : (
            <div className="flex items-center gap-[10px] p-[10px] rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
              <input type="text" placeholder="What should we build next? Tell us..." value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && feedbackText.trim()) {
                  fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, feedback: feedbackText, developmentId: dev.id }) });
                  setFeedbackText(""); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
                }}}
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-white placeholder:text-[rgba(255,255,255,0.2)]" />
              <button onClick={() => {
                if (!feedbackText.trim()) return;
                fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, feedback: feedbackText, developmentId: dev.id }) });
                setFeedbackText(""); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
              }} className="text-[11px] font-bold text-[#1ec6a4] flex-shrink-0">Send</button>
            </div>
          )}
        </div>

        <div className="text-center py-3 text-[rgba(255,255,255,0.1)] text-[10px]">BlockVoice — Your building, fully understood</div>

          </div>
        )}

        {/* ════════════════════ SERVICE CHARGES TAB ════════════════════ */}
        {activeTab === "charges" && (
          <ServiceChargesSection profileId={userId} buildingId={userBuildingId} postcode={dev.postcodes?.[0] || ""} buildingName={userBlockName} flatNumber={userFlat} />
        )}

        {/* ════════════════════ DOCUMENTS TAB ════════════════════ */}
        {activeTab === "documents" && (
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold text-[rgba(255,255,255,0.4)] mb-2">Document analysis — coming soon</p>
            <p className="text-[12px] text-[rgba(255,255,255,0.25)]">Upload your lease, service charge statements, and notices. AI will break them down in plain English.</p>
          </div>
        )}

        {/* ════════════════════ SETTINGS TAB ════════════════════ */}
        {activeTab === "settings" && (
          <div className="py-5">
            <div className="text-[12px] font-bold uppercase tracking-[1px] text-[rgba(255,255,255,0.2)] mb-3">Profile</div>
            <div className="space-y-0">
              <div className="flex py-[5px] text-[13px] px-1"><span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Name</span><span>{userName}</span></div>
              <div className="flex py-[5px] text-[13px] px-1"><span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Block</span><span>{userBlockName}</span></div>
              <div className="flex py-[5px] text-[13px] px-1"><span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Flat</span><span>{userFlat}</span></div>
              <div className="flex py-[5px] text-[13px] px-1"><span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Status</span><span className="capitalize">{userStatus}</span></div>
              <div className="flex py-[5px] text-[13px] px-1"><span className="w-[130px] flex-shrink-0 text-[12px] text-[rgba(255,255,255,0.3)]">Verified</span><span className="capitalize">{verificationStatus}</span></div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── old layout code removed ───

// ─── sub-components ─────────────────────────────────────────────────────────

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#132847] rounded-xl p-5 border border-[#1e3a5f]">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.3)]">{title}</h3>
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Service Charges Section ───────────────────────────────────────────────

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { ServiceChargeAnnual, PropertySize } from "../lib/database.types";

const SIZE_RANGES = [
  { label: "400–500", mid: 450 },
  { label: "500–600", mid: 550 },
  { label: "600–750", mid: 675 },
  { label: "750–900", mid: 825 },
  { label: "900–1,100", mid: 1000 },
  { label: "1,100–1,300", mid: 1200 },
  { label: "1,300–1,500", mid: 1400 },
  { label: "1,500+", mid: 1750 },
];

function ServiceChargesSection({
  profileId, buildingId, postcode, buildingName, flatNumber,
}: {
  profileId: string; buildingId: string; postcode: string; buildingName: string; flatNumber: string;
}) {
  const [annuals, setAnnuals] = useState<ServiceChargeAnnual[]>([]);
  const [propSize, setPropSize] = useState<PropertySize | null>(null);
  const [epcEstimate, setEpcEstimate] = useState<{ sqft: number; sqm: number } | null>(null);
  const [sizeInput, setSizeInput] = useState("");
  const [showSizeEditor, setShowSizeEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [scLoading, setScLoading] = useState(true);

  useEffect(() => {
    if (profileId && buildingId) loadServiceCharges();
  }, [profileId, buildingId]);

  async function loadServiceCharges() {
    setScLoading(true);
    const [{ data: annualData }, { data: sizeData }] = await Promise.all([
      supabase.from("service_charge_annuals").select("*").eq("profile_id", profileId).eq("building_id", buildingId).order("year"),
      supabase.from("property_sizes").select("*").eq("profile_id", profileId).eq("building_id", buildingId).single(),
    ]);
    if (annualData) setAnnuals(annualData as ServiceChargeAnnual[]);
    if (sizeData) setPropSize(sizeData as PropertySize);
    setScLoading(false);
  }

  const [uploadProgress, setUploadProgress] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 10) {
      setUploadError("Maximum 10 documents at a time.");
      return;
    }

    // Validate all files first
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "jpg", "jpeg", "png"].includes(ext || "")) {
        setUploadError(`${file.name}: Only PDF, JPG, or PNG files are supported.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name}: File must be under 10MB.`);
        return;
      }
    }

    setUploading(true);
    setUploadError("");
    const totalFiles = files.length;
    let processed = 0;
    let errors: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const filePath = `${profileId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      setUploadProgress(`Uploading ${processed + 1} of ${totalFiles}...`);
      const { error: upErr } = await supabase.storage.from("service-charges").upload(filePath, file);
      if (upErr) {
        errors.push(`${file.name}: upload failed`);
        processed++;
        continue;
      }

      setUploadProgress(`Analysing ${processed + 1} of ${totalFiles}...`);
      try {
        const res = await fetch("/api/service-charges/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentUrl: filePath, profileId, buildingId }),
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push(`${file.name}: ${data.error || "extraction failed"}`);
        }
      } catch {
        errors.push(`${file.name}: extraction failed`);
      }
      processed++;
    }

    setUploading(false);
    setUploadProgress("");

    if (errors.length > 0) {
      setUploadError(errors.join(". "));
    }

    // Reload data
    await loadServiceCharges();

    // If no property size yet, trigger EPC lookup
    if (!propSize) {
      setExtracting(true);
      try {
        const epcRes = await fetch(`/api/property-size?postcode=${encodeURIComponent(postcode)}&building=${encodeURIComponent(buildingName)}&flat=${encodeURIComponent(flatNumber)}`);
        const epcData = await epcRes.json();
        if (epcData.found) {
          setEpcEstimate({ sqft: epcData.sqft, sqm: epcData.sqm });
          setSizeInput(String(epcData.sqft));
        }
      } catch { /* EPC lookup is optional */ }
      setExtracting(false);
      setShowSizeEditor(true);
    }

    // Reset file input so same files can be re-selected
    e.target.value = "";
  }

  async function confirmSize(sqft: number, source: "epc" | "user_range" | "user_exact") {
    const sqm = Math.round(sqft / 10.764);
    const { data } = await supabase.from("property_sizes").upsert(
      { profile_id: profileId, building_id: buildingId, sqft, sqm, source, confirmed: true, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,building_id" }
    ).select().single();
    if (data) setPropSize(data as PropertySize);
    setShowSizeEditor(false);
  }

  // ─── computed values ───────────────────────────────────────────────────
  const sorted = [...annuals].sort((a, b) => a.year.localeCompare(b.year));
  const sqft = propSize?.sqft || 0;
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const earliest = sorted.length > 1 ? sorted[0] : null;

  // Detect billing type per record
  // If has_both_halves → we have the full year, show as Annual
  // If is_half_yearly and NOT has_both_halves → only one half, show as HY
  const latestTotal = latest ? Number(latest.annual_total) : 0;
  const latestIsHY = latest ? latest.is_half_yearly : false;
  const latestHasBoth = latest ? latest.has_both_halves : false;
  const latestIsPartial = latestIsHY && !latestHasBoth; // only one half uploaded

  // Detect quarterly (quarter_count present and < 4 means partial)
  const latestQuarters = latest ? latest.quarter_count || 0 : 0;
  const isQuarterly = latestQuarters > 0;

  // Period label for the latest entry
  const periodLabel = isQuarterly
    ? (latestQuarters < 4 ? "Quarterly" : "Annual")
    : (latestIsPartial ? "Half Year" : "Annual");
  const periodLabelShort = isQuarterly
    ? (latestQuarters < 4 ? `Q${latestQuarters}` : "FY")
    : (latestIsPartial ? "HY" : "FY");

  // Monthly: divide by actual months covered
  const latestMonths = isQuarterly
    ? latestQuarters * 3
    : (latestIsPartial ? 6 : 12);
  const monthly = latestTotal / latestMonths;

  // For per-sqft, always annualise
  const annualisedTotal = isQuarterly
    ? (latestQuarters < 4 ? (latestTotal / latestQuarters) * 4 : latestTotal)
    : (latestIsPartial ? latestTotal * 2 : latestTotal);
  const perSqft = sqft > 0 ? annualisedTotal / sqft : 0;
  const perSqftMonth = perSqft / 12;

  // Growth: compare like-for-like, annualised
  const earliestTotal = earliest ? Number(earliest.annual_total) : 0;
  const earliestIsHY = earliest ? earliest.is_half_yearly : false;
  const earliestHasBoth = earliest ? earliest.has_both_halves : false;
  const earliestQuarters = earliest ? earliest.quarter_count || 0 : 0;
  const earliestIsQuarterly = earliestQuarters > 0;
  const earliestIsPartial = (earliestIsHY && !earliestHasBoth) || (earliestIsQuarterly && earliestQuarters < 4);
  const earliestAnnualised = earliestIsQuarterly
    ? (earliestQuarters < 4 ? (earliestTotal / earliestQuarters) * 4 : earliestTotal)
    : (earliestIsPartial ? earliestTotal * 2 : earliestTotal);

  const growthPct = earliest && latest && earliestAnnualised > 0
    ? ((annualisedTotal - earliestAnnualised) / earliestAnnualised) * 100
    : 0;
  const earliestMonths = earliestIsQuarterly ? earliestQuarters * 3 : (earliestIsPartial ? 6 : 12);
  const earliestMonthly = earliestTotal / earliestMonths;
  const monthlyIncrease = earliest && latest ? monthly - earliestMonthly : 0;

  const chartData = sorted.map(a => {
    const total = Number(a.annual_total);
    const aIsHY = a.is_half_yearly;
    const aHasBoth = a.has_both_halves;
    const aQuarters = a.quarter_count || 0;
    const aIsQ = aQuarters > 0;
    const months = aIsQ ? aQuarters * 3 : (aIsHY && !aHasBoth ? 6 : 12);
    const annualised = aIsQ
      ? (aQuarters < 4 ? (total / aQuarters) * 4 : total)
      : (aIsHY && !aHasBoth ? total * 2 : total);
    return {
      year: a.year,
      annual: total,
      monthly: total / months,
      perSqft: sqft > 0 ? annualised / sqft : 0,
      label: aIsQ ? (aQuarters < 4 ? `Q${aQuarters}` : "FY") : (aIsHY && !aHasBoth ? "HY" : "FY"),
    };
  });

  // YoY growth per year (annualised comparison)
  const yoyData = chartData.slice(1).map((curr, i) => {
    const prev = chartData[i];
    const prevAnnualised = prev.perSqft;
    const currAnnualised = curr.perSqft;
    const pct = prevAnnualised > 0 ? ((currAnnualised - prevAnnualised) / prevAnnualised) * 100 : 0;
    return { year: curr.year, pct, prevSqft: prevAnnualised, currSqft: currAnnualised };
  });

  // Last year's YoY for the headline stat
  const lastYoY = yoyData.length > 0 ? yoyData[yoyData.length - 1] : null;

  const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmt2 = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── render ────────────────────────────────────────────────────────────

  if (scLoading) return <Card title="Service Charges" badge={<span className="text-[9px] font-extrabold bg-[#fbbf24] text-[#412402] px-2 py-0.5 rounded-full">BETA</span>}><p className="text-sm text-[rgba(255,255,255,0.3)]">Loading...</p></Card>;

  // Empty state — no data yet
  if (annuals.length === 0 && !extracting) {
    return (
      <Card title="Service Charges" badge={<span className="text-[9px] font-extrabold bg-[#fbbf24] text-[#412402] px-2 py-0.5 rounded-full">BETA</span>}>
        <div className="text-center py-8 border border-dashed border-[#1e3a5f] rounded-lg">
          <span className="text-3xl mb-3 block">💷</span>
          <p className="text-sm text-white font-semibold mb-1">Upload your service charge documents</p>
          <p className="text-xs text-[rgba(255,255,255,0.4)] mb-4 max-w-sm mx-auto leading-relaxed">
            Upload your service charge documents and our AI will work out how to allocate them across periods and track your costs.
          </p>
          <label className="inline-block cursor-pointer px-5 py-2.5 bg-[#1ec6a4] text-white text-sm font-bold rounded-lg hover:bg-[#25d4b0] transition-colors">
            Upload your service charge
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} multiple />
          </label>
          <p className="text-[10px] text-[rgba(255,255,255,0.25)] mt-2">Takes 30 seconds. We extract the data automatically.</p>
          {(uploading || uploadProgress) && <p className="text-sm text-[#1ec6a4] mt-3">{uploadProgress || "Uploading..."}</p>}
          {extracting && <p className="text-sm text-[#1ec6a4] mt-3">Analysing your document...</p>}
          {uploadError && <p className="text-sm text-red-400 mt-3">{uploadError}</p>}
        </div>
      </Card>
    );
  }

  if (extracting) {
    return (
      <Card title="Service Charges" badge={<span className="text-[9px] font-extrabold bg-[#fbbf24] text-[#412402] px-2 py-0.5 rounded-full">BETA</span>}>
        <div className="text-center py-10">
          <p className="text-lg text-[#1ec6a4] font-semibold animate-pulse">Analysing your documents...</p>
          <p className="text-xs text-[rgba(255,255,255,0.3)] mt-2">This usually takes 10–20 seconds per document.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Service Charges" badge={<span className="text-[9px] font-extrabold bg-[#fbbf24] text-[#412402] px-2 py-0.5 rounded-full">BETA</span>}>
        {/* Property size bar */}
        {propSize && !showSizeEditor ? (
          <div className="flex items-center justify-between bg-[#0f1f3d] rounded-lg px-4 py-2.5 mb-4">
            <span className="text-sm text-[rgba(255,255,255,0.7)]">
              ✅ Property size: <strong className="text-white">{fmt(propSize.sqft)} sqft</strong>
              <span className="text-[rgba(255,255,255,0.3)]"> ({propSize.sqm || Math.round(propSize.sqft / 10.764)} sqm)</span>
            </span>
            <button onClick={() => setShowSizeEditor(true)} className="text-xs text-[#1ec6a4] hover:underline">Adjust</button>
          </div>
        ) : (showSizeEditor || (!propSize && annuals.length > 0)) ? (
          <div className="bg-[#0f1f3d] rounded-xl p-5 mb-4 border border-[#1e3a5f]">
            <h4 className="font-bold text-white text-sm mb-1">📐 Have we got your property size right?</h4>
            {epcEstimate ? (
              <p className="text-xs text-[rgba(255,255,255,0.4)] mb-3">
                We estimated <strong className="text-white">{fmt(epcEstimate.sqft)} sqft</strong> from public records.
                This affects your price per sqft calculation.
              </p>
            ) : (
              <p className="text-xs text-[rgba(255,255,255,0.4)] mb-3">
                We couldn&apos;t find your size automatically. Select your approximate size or enter exact.
              </p>
            )}
            <p className="text-xs text-[rgba(255,255,255,0.3)] mb-2">Select your approximate size:</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SIZE_RANGES.map(r => (
                <button key={r.label} onClick={() => { setSizeInput(String(r.mid)); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    sizeInput === String(r.mid)
                      ? "bg-[#1ec6a4] border-[#1ec6a4] text-white font-bold"
                      : "bg-[#132847] border-[#1e3a5f] text-[rgba(255,255,255,0.5)] hover:border-[#1ec6a4]"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[rgba(255,255,255,0.3)]">Or enter exact:</span>
              <input type="number" value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                className="w-24 bg-[#132847] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-white text-sm outline-none" />
              <span className="text-xs text-[rgba(255,255,255,0.3)]">sqft</span>
            </div>
            {sizeInput && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-[rgba(255,255,255,0.5)]">
                  Using: <strong className="text-white">{fmt(parseInt(sizeInput))} sqft</strong>
                  <span className="text-[rgba(255,255,255,0.3)]"> ({Math.round(parseInt(sizeInput) / 10.764)} sqm)</span>
                </span>
                <button onClick={() => confirmSize(parseInt(sizeInput), SIZE_RANGES.some(r => String(r.mid) === sizeInput) ? "user_range" : "user_exact")}
                  className="px-4 py-1.5 bg-[#1ec6a4] text-white text-sm font-bold rounded-lg hover:bg-[#25d4b0]">
                  Confirm
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#0f1f3d] rounded-lg p-3.5 text-center">
            <div className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-1.5">Service charge rate</div>
            <div className="text-2xl font-black text-[#1ec6a4]">{sqft > 0 ? `£${fmt2(perSqft)}` : "—"}</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">per sqft / year</div>
          </div>
          <div className="bg-[#0f1f3d] rounded-lg p-3.5 text-center">
            <div className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-1.5">Monthly cost</div>
            <div className="text-2xl font-black text-white">£{fmt(monthly)}</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">per month</div>
          </div>
          <div className="rounded-lg p-3.5 text-center" style={{ background: lastYoY && lastYoY.pct > 5 ? "rgba(248,113,113,0.06)" : "#0f1f3d", border: lastYoY && lastYoY.pct > 5 ? "1px solid rgba(248,113,113,0.15)" : "1px solid transparent" }}>
            <div className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-1.5">Last year&apos;s increase</div>
            <div className={`text-2xl font-black ${lastYoY && lastYoY.pct > 5 ? "text-red-400" : lastYoY && lastYoY.pct > 0 ? "text-amber-400" : "text-[#1ec6a4]"}`}>
              {lastYoY ? `${lastYoY.pct >= 0 ? "+" : ""}${fmt2(lastYoY.pct)}%` : "—"}
            </div>
            <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">year on year</div>
          </div>
        </div>

        {/* Year-on-year growth per year */}
        {yoyData.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-2">Year-on-year growth</div>
            <div className={`grid gap-2 ${yoyData.length >= 3 ? "grid-cols-3" : yoyData.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {yoyData.map((y, i) => (
                <div key={i} className="bg-[#0f1f3d] rounded-lg p-3 text-center" style={{ background: y.pct > 5 ? "rgba(248,113,113,0.06)" : undefined, border: y.pct > 5 ? "1px solid rgba(248,113,113,0.15)" : "1px solid #1e3a5f" }}>
                  <div className="text-[9px] text-[rgba(255,255,255,0.3)] mb-1">{y.year}</div>
                  <div className={`text-lg font-extrabold ${y.pct > 5 ? "text-red-400" : y.pct > 0 ? "text-amber-400" : "text-[#1ec6a4]"}`}>
                    {y.pct >= 0 ? "+" : ""}{fmt2(y.pct)}%
                  </div>
                  <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-1">£{fmt2(y.prevSqft)} → £{fmt2(y.currSqft)}/sqft</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="space-y-6">
            {/* Annual bar chart */}
            <div>
              <p className="text-xs font-semibold text-[rgba(255,255,255,0.4)] mb-3">Service Charge by Period</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                    formatter={(v) => [`£${fmt(Number(v))}`, "Annual"]} />
                  <Bar dataKey="annual" fill="#1ec6a4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Per sqft line chart */}
            {sqft > 0 && (
              <div>
                <p className="text-xs font-semibold text-[rgba(255,255,255,0.4)] mb-3">Price Per Square Foot — Annualised</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                      formatter={(v) => [`£${fmt2(Number(v))}/sqft`, "Per sqft"]} />
                    <Line type="monotone" dataKey="perSqft" stroke="#1ec6a4" strokeWidth={2} dot={{ fill: "#1ec6a4", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly bar chart */}
            <div>
              <p className="text-xs font-semibold text-[rgba(255,255,255,0.4)] mb-3">Monthly Service Charge</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v.toFixed(0)}`} />
                  <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                    formatter={(v) => [`£${fmt(Number(v))}`, "Monthly"]} />
                  <Bar dataKey="monthly" fill="rgba(30,198,164,0.6)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Key insights */}
        {lastYoY && (
          <div className="mt-5 rounded-lg p-4 border" style={{ background: "rgba(30,198,164,0.04)", borderColor: "rgba(30,198,164,0.15)" }}>
            <p className="text-[10px] uppercase font-bold tracking-wide text-[#1ec6a4] mb-1">Key Insights</p>
            <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed">
              Your service charge increased <strong className={lastYoY.pct > 5 ? "text-red-400" : "text-amber-400"}>+{fmt2(lastYoY.pct)}%</strong> last year
              {yoyData.length > 1 && yoyData[yoyData.length - 1].pct > yoyData[yoyData.length - 2].pct
                ? <>, up from +{fmt2(yoyData[yoyData.length - 2].pct)}% the year before. The rate of increase is <strong className="text-red-400">accelerating</strong></>
                : yoyData.length > 1
                ? <>, down from +{fmt2(yoyData[yoyData.length - 2].pct)}% the year before</>
                : null
              }.{" "}
              {sqft > 0 && <>You are paying <strong className="text-white">£{fmt2(perSqft)} per sqft</strong> per year (£{fmt2(perSqftMonth)}/sqft per month). </>}
              {sqft > 0 && lastYoY.pct > 0 && <>At this rate, next year could exceed £{fmt2(perSqft * (1 + lastYoY.pct / 100))}/sqft.</>}
            </p>
          </div>
        )}

        {/* Upload more */}
        <div className="mt-4 text-center">
          <p className="text-xs text-[rgba(255,255,255,0.3)] mb-2">Upload another year&apos;s service charge to extend your trend.</p>
          <label className="inline-block cursor-pointer px-4 py-2 bg-[#132847] text-[#1ec6a4] text-xs font-bold rounded-lg border border-[#1e3a5f] hover:border-[#1ec6a4] transition-colors">
            Upload another year
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} multiple />
          </label>
          {(uploading || uploadProgress) && <p className="text-sm text-[#1ec6a4] mt-2">{uploadProgress || "Uploading..."}</p>}
          {extracting && <p className="text-sm text-[#1ec6a4] mt-2">Analysing...</p>}
          {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
        </div>
      </Card>
    </div>
  );
}
