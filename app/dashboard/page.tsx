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
      .neq("status", "resolved")
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
        return {
          ...issue,
          supporter_count: (sc || 0) + 1,
          user_supported: (userSup && userSup.length > 0) || issue.raised_by === uid,
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

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex justify-between items-center px-6 md:px-8 py-3.5 border-b border-[#1e3a5f]" style={{ background: "#0f1f3d" }}>
        <Link href="/dashboard" className="text-lg font-extrabold text-[#1ec6a4]">BlockVoice</Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[rgba(255,255,255,0.4)] hidden sm:inline">{dev.name}</span>
          <span className="text-xs text-[rgba(255,255,255,0.55)]">{userName}</span>
          <button onClick={handleLogout} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white">Log out</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-6">

        {/* ── Verification Banner ────────────────────────────────────── */}
        {verificationStatus !== "verified" && (
          <Link href="/verify"
            className="flex items-center justify-between bg-[#132847] border border-amber-900/30 rounded-xl px-5 py-3 hover:border-[#1ec6a4]/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg">{verificationStatus === "pending" ? "⏳" : "🔒"}</span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {verificationStatus === "pending" ? "Verification in progress" : "Verify your identity"}
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.4)]">
                  {verificationStatus === "pending"
                    ? "We're reviewing your document — usually 1–2 working days."
                    : "Upload a document to prove your address and unlock all features."}
                </p>
              </div>
            </div>
            <span className="text-xs text-[#1ec6a4] font-semibold flex-shrink-0">
              {verificationStatus === "pending" ? "View status →" : "Verify now →"}
            </span>
          </Link>
        )}

        {/* ── Development Overview (compact + action bar) ──────────── */}
        <Card title="Your Development">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-extrabold text-white">{dev.name}</h2>
              <span className="text-[11px] text-[rgba(255,255,255,0.45)]">{dev.postcodes?.[0]} · {dev.total_units.toLocaleString()} units{blocks.length > 0 ? ` · ${blocks.length} blocks` : ""}{dev.developer ? ` · ${dev.developer}` : ""}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[rgba(255,255,255,0.5)]">{memberCount} of ~{dev.total_units} signed up</span>
              <div className="text-sm font-extrabold text-[#1ec6a4]">{pct}%</div>
            </div>
          </div>
          <div className="mt-2 bg-[#0f1f3d] rounded h-1 overflow-hidden">
            <div className="bg-[#1ec6a4] h-1 rounded transition-all" style={{ width: `${Math.max(Math.min(pct, 100), 0.5)}%` }} />
          </div>
          {/* Action bar */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-[#1e3a5f]">
            <button onClick={() => setInviteOpen(!inviteOpen)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#1ec6a4] text-[#0f1f3d] border-none rounded-lg py-2.5 font-bold text-xs cursor-pointer">
              👥 Invite your neighbours
            </button>
            <button onClick={() => setFeedbackOpen(!feedbackOpen)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#334155] text-white border border-[#1e3a5f] rounded-lg py-2.5 font-bold text-xs cursor-pointer">
              💬 Send us feedback
            </button>
          </div>
        </Card>

        {/* Invite expanded */}
        {inviteOpen && dev && (
          <Card title="">
            <div className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-2">Invite other residents</div>
            <div className="flex gap-1.5 mb-2">
              <input readOnly value={`blockvoice.co.uk/join/${dev.slug}`}
                className="flex-1 bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs" />
              <button onClick={() => { navigator.clipboard.writeText(`https://blockvoice.co.uk/join/${dev.slug}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                className="bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-[11px] font-semibold cursor-pointer">
                {linkCopied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Hey 👋 I've joined BlockVoice for ${dev.name}. Join here: https://blockvoice.co.uk/join/${dev.slug}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white border-none rounded-lg py-2 font-bold text-xs">
                💬 WhatsApp
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(`Join BlockVoice for ${dev.name}`)}&body=${encodeURIComponent(`Join BlockVoice for ${dev.name}: https://blockvoice.co.uk/join/${dev.slug}`)}`}
                className="flex items-center justify-center gap-1.5 bg-[#334155] text-white border-none rounded-lg py-2 font-bold text-xs">
                ✉️ Email
              </a>
            </div>
          </Card>
        )}

        {/* Feedback expanded */}
        {feedbackOpen && (
          <Card title="">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-white">We&apos;d love your feedback</h3>
              <button onClick={() => setFeedbackOpen(false)} className="text-[rgba(255,255,255,0.3)] text-lg cursor-pointer bg-transparent border-none">×</button>
            </div>
            <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-2">Tell us what&apos;s working, what&apos;s not, and what you&apos;d like to see next.</p>
            <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
              placeholder="What would make BlockVoice more useful?"
              rows={3} className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs resize-none mb-2" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[rgba(255,255,255,0.2)]">Sent to hello@blockvoice.co.uk</span>
              <button onClick={async () => {
                await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, message: feedbackText }) });
                setFeedbackText(""); setFeedbackOpen(false); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
              }} className="bg-[#1ec6a4] text-[#0f1f3d] border-none rounded-lg px-5 py-2 font-bold text-xs cursor-pointer">Send</button>
            </div>
          </Card>
        )}
        {feedbackSent && <p className="text-xs text-green-400 text-center">Thanks! Your feedback has been sent.</p>}

        {/* ── Service Charges (moved up — highest value section) ──────── */}
        {userStatus === "owner" && (
          <ServiceChargesSection
            profileId={userId}
            buildingId={userBuildingId}
            postcode={dev?.postcodes?.[0] || ""}
            buildingName={userBlockName || ""}
            flatNumber={userFlat || ""}
          />
        )}

        {/* ── Agent + Freeholder — 2 columns on desktop ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Managing Agent (compact) */}
          <Card title="Managing Agent">
            {agent ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-bold text-white">{agent.name}</span>
                  {link && confidenceBadge(link.agent_confidence)}
                </div>
                {agent.phone && <div className="text-[11px] text-[rgba(255,255,255,0.5)]">{agent.phone}</div>}
                {/* Overall score */}
                <div className="flex items-center gap-2 mt-2">
                  {agentAgg ? (
                    <>
                      <span className={`text-lg font-black ${ratingColor(agentAgg.overall)}`}>{agentAgg.overall.toFixed(1)}</span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.3)]">/ 5.0 · {allAgentRatings.length} ratings</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-[rgba(255,255,255,0.3)]">
                      {allAgentRatings.length > 0
                        ? `${allAgentRatings.length} rating${allAgentRatings.length !== 1 ? "s" : ""} — need ${3 - allAgentRatings.length} more to show.`
                        : "No ratings yet — be the first!"}
                    </span>
                  )}
                </div>
                {/* Collapsible full ratings */}
                {agentAgg && (
                  <button onClick={() => setShowAgentDetails(!showAgentDetails)} className="text-[10px] text-[#1ec6a4] bg-transparent border-none cursor-pointer mt-1 p-0">
                    {showAgentDetails ? "Hide ratings" : "See full ratings"}
                  </button>
                )}
                {showAgentDetails && agentAgg && (
                  <div className="mt-2 pt-2 border-t border-[#1e3a5f]">
                    {AGENT_CATS.map(c => (
                      <div key={c} className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-[rgba(255,255,255,0.35)]">{AGENT_LABELS[c]}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-[50px] h-[3px] bg-[#0f1f3d] rounded overflow-hidden">
                            <div className={`h-full ${ratingBarColor(agentAgg[c])}`} style={{ width: `${(agentAgg[c] / 5) * 100}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${ratingColor(agentAgg[c])}`}>{agentAgg[c].toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowAgentRating(!showAgentRating)}
                  className="mt-2 w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg py-1.5 text-[11px] font-semibold text-[#1ec6a4] cursor-pointer">
                  {myAgentRating ? "★ Update your rating" : "★ Rate this managing agent"}
                </button>
                {showAgentRating && (
                  <div className="mt-3 space-y-2.5">
                    {AGENT_CATS.map(c => (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-xs text-[rgba(255,255,255,0.55)]">{AGENT_LABELS[c]}</span>
                        <StarSelector value={agentForm[c] || 0} onChange={v => setAgentForm({ ...agentForm, [c]: v })} />
                      </div>
                    ))}
                    <textarea placeholder="Optional comment..." value={agentComment} onChange={e => setAgentComment(e.target.value)}
                      rows={2} className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs resize-none" />
                    <button onClick={submitAgentRating} disabled={submittingRating}
                      className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                      {submittingRating ? "Saving..." : myAgentRating ? "Update Rating" : "Submit Rating"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[rgba(255,255,255,0.3)] text-sm">No managing agent recorded yet.</p>
            )}
          </Card>

          {/* Freeholder (compact) */}
          <Card title="Freeholder">
            {freeholder ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-bold text-white">{freeholder.name}</span>
                  {link && confidenceBadge(link.freeholder_confidence)}
                </div>
                {freeholder.parent_company && (
                  <div className="text-[11px] text-[rgba(255,255,255,0.5)]">{freeholder.parent_company}</div>
                )}
                {/* Overall score */}
                <div className="flex items-center gap-2 mt-2">
                  {fhAgg ? (
                    <>
                      <span className={`text-lg font-black ${ratingColor(fhAgg.overall)}`}>{fhAgg.overall.toFixed(1)}</span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.3)]">/ 5.0 · {allFhRatings.length} ratings</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-[rgba(255,255,255,0.3)]">
                      {allFhRatings.length > 0
                        ? `${allFhRatings.length} rating${allFhRatings.length !== 1 ? "s" : ""} — need ${3 - allFhRatings.length} more to show.`
                        : "No ratings yet — be the first!"}
                    </span>
                  )}
                </div>
                {fhAgg && (
                  <button onClick={() => setShowFhDetails(!showFhDetails)} className="text-[10px] text-[#1ec6a4] bg-transparent border-none cursor-pointer mt-1 p-0">
                    {showFhDetails ? "Hide ratings" : "See full ratings"}
                  </button>
                )}
                {showFhDetails && fhAgg && (
                  <div className="mt-2 pt-2 border-t border-[#1e3a5f]">
                    {FH_CATS.map(c => (
                      <div key={c} className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-[rgba(255,255,255,0.35)]">{FH_LABELS[c]}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-[50px] h-[3px] bg-[#0f1f3d] rounded overflow-hidden">
                            <div className={`h-full ${ratingBarColor(fhAgg[c])}`} style={{ width: `${(fhAgg[c] / 5) * 100}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${ratingColor(fhAgg[c])}`}>{fhAgg[c].toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowFhRating(!showFhRating)}
                  className="mt-2 w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg py-1.5 text-[11px] font-semibold text-[#1ec6a4] cursor-pointer">
                  {myFhRating ? "★ Update your rating" : "★ Rate this freeholder"}
                </button>
                {showFhRating && (
                  <div className="mt-3 space-y-2.5">
                    {FH_CATS.map(c => (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-xs text-[rgba(255,255,255,0.55)]">{FH_LABELS[c]}</span>
                        <StarSelector value={fhForm[c] || 0} onChange={v => setFhForm({ ...fhForm, [c]: v })} />
                      </div>
                    ))}
                    <textarea placeholder="Optional comment..." value={fhComment} onChange={e => setFhComment(e.target.value)}
                      rows={2} className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs resize-none" />
                    <button onClick={submitFhRating} disabled={submittingRating}
                      className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                      {submittingRating ? "Saving..." : myFhRating ? "Update Rating" : "Submit Rating"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[rgba(255,255,255,0.3)] text-sm">No freeholder recorded yet.</p>
            )}
          </Card>
        </div>

        {/* ── Blocks Grid ────────────────────────────────────────────── */}
        {blocks.length > 0 && (
          <Card title="Blocks in Your Development">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {blocks.map(b => {
                const isUser = b.id === userBlockId;
                const bIssues = issuesByBlock[b.id] || 0;
                return (
                  <div key={b.id}
                    className={`rounded-xl p-4 border transition-colors ${isUser ? "border-[#1ec6a4] ring-1 ring-[#1ec6a4]/30 bg-[#162d50]" : "border-[#1e3a5f] bg-[#0f1f3d]"}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <h4 className="font-semibold text-white text-sm">{b.name}</h4>
                      {isUser && <span className="text-[8px] font-bold uppercase bg-[#1ec6a4]/20 text-[#1ec6a4] px-1.5 py-0.5 rounded tracking-wide">You</span>}
                    </div>
                    <div className="space-y-0.5 text-xs text-[rgba(255,255,255,0.55)]">
                      <p>{b.total_units} apartments</p>
                      <p>{bIssues} issue{bIssues !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Issues ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold">Issues in Your Development</h2>
            <button onClick={() => setShowIssueForm(!showIssueForm)}
              className="bg-[#1ec6a4] hover:bg-[#25d4b0] text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {showIssueForm ? "Cancel" : "Report Issue"}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}
              className="bg-[#132847] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="">All Blocks</option>
              {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="bg-[#132847] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c.replace("_", " ")}</option>)}
            </select>
          </div>

          {/* Issue form */}
          {showIssueForm && (
            <Card title="Report an Issue">
              <div className="space-y-3">
                <input type="text" placeholder="Issue title (e.g. Broken lift)" value={newIssue.title}
                  onChange={e => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white text-sm" />
                <textarea placeholder="Describe the issue..." value={newIssue.description}
                  onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} rows={3}
                  className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white text-sm resize-none" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newIssue.category} onChange={e => setNewIssue({ ...newIssue, category: e.target.value })}
                    className="bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm">
                    {categories.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c.replace("_", " ")}</option>)}
                  </select>
                  {blocks.length > 0 && (
                    <select value={newIssue.block_id} onChange={e => setNewIssue({ ...newIssue, block_id: e.target.value })}
                      className="bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm">
                      <option value="">Whole development</option>
                      {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                </div>
                <label className="flex items-center gap-3 bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-3 cursor-pointer hover:border-[#1ec6a4]/30">
                  <input type="checkbox" checked={isAnonymous} onChange={() => setIsAnonymous(!isAnonymous)} className="w-4 h-4 accent-[#1ec6a4]" />
                  <div>
                    <span className="text-sm text-white">Report anonymously</span>
                    <p className="text-xs text-[rgba(255,255,255,0.3)] mt-0.5">Your name will be hidden from other residents.</p>
                  </div>
                </label>
                <button onClick={submitIssue} disabled={submittingIssue}
                  className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {submittingIssue ? "Submitting..." : "Submit Issue"}
                </button>
              </div>
            </Card>
          )}

          {/* Issue list */}
          {filtered.length === 0 ? (
            <Card title="No open issues">
              <p className="text-[rgba(255,255,255,0.3)] text-sm">No issues have been raised yet. Be the first!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(issue => (
                <div key={issue.id} className="bg-[#132847] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">
                      <span className="mr-1.5">{CATEGORY_EMOJI[issue.category] || "📋"}</span>
                      {issue.title}
                    </h4>
                    {statusBadge(issue.status)}
                  </div>
                  {issue.description && (
                    <p className="text-[rgba(255,255,255,0.55)] text-xs mt-1 mb-2">{issue.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[rgba(255,255,255,0.3)] mb-3">
                    <span>{issue.supporter_count} {issue.supporter_count === 1 ? "resident" : "residents"}</span>
                    <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                    {issue.block_id && blocks.find(b => b.id === issue.block_id) && (
                      <span className="bg-[#162d50] px-2 py-0.5 rounded text-[10px]">
                        {blocks.find(b => b.id === issue.block_id)?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleSupport(issue.id, issue.user_supported)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        issue.user_supported
                          ? "bg-green-900/60 text-green-400"
                          : "bg-[#0f1f3d] border border-[#1e3a5f] text-[rgba(255,255,255,0.55)] hover:border-[#1ec6a4]/40"
                      }`}>
                      {issue.user_supported ? "✓ Supported" : "I have this problem too"}
                    </button>
                    <button onClick={() => {
                      if (expandedIssue === issue.id) { setExpandedIssue(null); }
                      else { setExpandedIssue(issue.id); loadSupporters(issue.id); }
                    }} className="text-xs text-[#1ec6a4] hover:underline">
                      {expandedIssue === issue.id ? "Hide names" : "See who"}
                    </button>
                  </div>
                  {expandedIssue === issue.id && supporters[issue.id] && (
                    <div className="mt-3 bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg p-3">
                      <p className="text-xs text-[rgba(255,255,255,0.3)] mb-1.5 font-semibold">Supported by:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {supporters[issue.id].map((s, i) => (
                          <span key={i} className="text-xs bg-[#1ec6a4]/10 text-[#1ec6a4] px-2 py-1 rounded-full">
                            {s.first_name} {s.last_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (Invite section moved into overview card action bar above) */}

        {/* ── Coming Soon ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-bold mb-4">Coming Soon</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: "📄", title: "AI Document Analysis", desc: "Upload your lease or service charge statement and get plain-English summaries and anomaly flags." },
              { icon: "📊", title: "Managing Agent Scorecard", desc: "Compare your managing agent against others across all developments they manage." },
              { icon: "✍️", title: "AI Complaint Drafting", desc: "Generate formal complaints based on your issues and evidence, with legal guidance." },
              { icon: "💷", title: "Service Charge Comparison", desc: "See how your charges compare to similar developments in your area." },
            ].map(item => (
              <div key={item.title} className="bg-[#132847] rounded-xl p-4 border border-dashed border-[#1e3a5f] opacity-50">
                <span className="text-xl block mb-2">{item.icon}</span>
                <h3 className="font-semibold text-sm text-white mb-1">{item.title}</h3>
                <p className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed">{item.desc}</p>
                <span className="inline-block mt-2 text-[8px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wide bg-amber-900/30 text-amber-400 border border-amber-800/30">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Suggest correction (bottom) ──────────────────────────────── */}
        <div className="text-center">
          <button onClick={() => setShowCorrection(!showCorrection)} className="text-[11px] text-[rgba(255,255,255,0.3)] hover:underline bg-transparent border-none cursor-pointer">
            Something wrong? Suggest a correction
          </button>
          {corrSuccess && <p className="text-xs text-green-400 mt-1">Thanks! We&apos;ll review your correction.</p>}
        </div>
        {showCorrection && (
          <Card title="Suggest a Correction">
            <div className="space-y-3">
              <select value={corrField} onChange={e => setCorrField(e.target.value)}
                className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white text-sm">
                <option value="">What needs correcting?</option>
                {CORRECTION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              {corrField && (
                <>
                  {getCurrentValue(corrField) && (
                    <p className="text-xs text-[rgba(255,255,255,0.3)]">Currently: {getCurrentValue(corrField)}</p>
                  )}
                  <input type="text" value={corrValue} onChange={e => setCorrValue(e.target.value)}
                    placeholder="What should it be?" className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white text-sm" />
                  <button onClick={submitCorrection} disabled={submittingCorr}
                    className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                    {submittingCorr ? "Submitting..." : "Submit Correction"}
                  </button>
                </>
              )}
            </div>
          </Card>
        )}

        <div className="text-center py-3 text-[#334155] text-[10px]">BlockVoice — Everything about your building. In one place.</div>

      </div>
    </div>
  );
}

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

function ContactDetails({ phone, email, website, address }: { phone?: string | null; email?: string | null; website?: string | null; address?: string | null }) {
  const rows = [
    phone && { label: "Phone", value: phone, href: `tel:${phone}` },
    email && { label: "Email", value: email, href: `mailto:${email}` },
    website && { label: "Website", value: website, href: website.startsWith("http") ? website : `https://${website}` },
    address && { label: "Address", value: address },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  if (rows.length === 0) return <p className="text-[rgba(255,255,255,0.3)] text-sm mt-2">No contact details on file.</p>;

  return (
    <div className="space-y-2 mt-2">
      {rows.map(r => (
        <div key={r.label} className="flex items-start gap-2 text-sm">
          <span className="text-[rgba(255,255,255,0.3)] w-16 flex-shrink-0">{r.label}</span>
          {r.href ? (
            <a href={r.href} className="text-[#1ec6a4] hover:underline break-all" target="_blank" rel="noopener noreferrer">{r.value}</a>
          ) : (
            <span className="text-[rgba(255,255,255,0.7)] break-all">{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} onClick={() => onChange(star)} type="button"
          className={`text-lg transition-colors ${star <= value ? "text-amber-400" : "text-[rgba(255,255,255,0.15)]"} hover:text-amber-300`}>
          ★
        </button>
      ))}
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
