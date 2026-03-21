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
      setVerificationStatus(profile.verification_status || "unverified");

      const { data: building } = await supabase
        .from("buildings")
        .select("id, name, total_flats, development_name")
        .eq("id", profile.building_id)
        .single();
      if (!building?.development_name) return;

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

        {/* ── Development Overview ────────────────────────────────────── */}
        <Card title="Your Development">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1">{dev.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[rgba(255,255,255,0.55)]">
                <span>{dev.postcodes?.[0]}</span>
                <span className="text-[rgba(255,255,255,0.2)]">·</span>
                <span>{dev.total_units.toLocaleString()} units</span>
                {dev.developer && (
                  <>
                    <span className="text-[rgba(255,255,255,0.2)]">·</span>
                    <span>{dev.developer}</span>
                  </>
                )}
              </div>
            </div>
            <div className="md:w-80 flex-shrink-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[rgba(255,255,255,0.55)]">{memberCount} of ~{dev.total_units} apartments signed up</span>
                <span className="text-[#1ec6a4] font-semibold">{pct}%</span>
              </div>
              <div className="w-full bg-[#0f1f3d] rounded-full h-2.5">
                <div className="bg-[#1ec6a4] h-2.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Agent + Freeholder — 2 columns on desktop ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Managing Agent */}
          <Card title="Managing Agent">
            {agent ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">{agent.name}</span>
                  {link && confidenceBadge(link.agent_confidence)}
                </div>
                {link?.agent_source && (
                  <p className="text-xs text-[rgba(255,255,255,0.3)] mb-3">Source: {link.agent_source}</p>
                )}
                <ContactDetails phone={agent.phone} email={agent.email} website={agent.website} address={agent.address} />

                {/* Inline rating */}
                <div className="mt-4 pt-4 border-t border-[#1e3a5f]">
                  {agentAgg ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xl font-bold ${ratingColor(agentAgg.overall)}`}>{agentAgg.overall.toFixed(1)}</span>
                        <span className="text-xs text-[rgba(255,255,255,0.3)]">/ 5.0 · {allAgentRatings.length} ratings</span>
                      </div>
                      <div className="space-y-1.5">
                        {AGENT_CATS.map(c => (
                          <div key={c} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-[rgba(255,255,255,0.45)]">{AGENT_LABELS[c]}</span>
                            <div className="flex-1 h-1.5 bg-[#0f1f3d] rounded-full overflow-hidden">
                              <div className={`h-1.5 rounded-full ${ratingBarColor(agentAgg[c])}`} style={{ width: `${(agentAgg[c] / 5) * 100}%` }} />
                            </div>
                            <span className="w-5 text-right font-semibold text-white text-[11px]">{agentAgg[c].toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.3)] mb-2">
                      {allAgentRatings.length > 0
                        ? `${allAgentRatings.length} rating${allAgentRatings.length !== 1 ? "s" : ""} — need ${3 - allAgentRatings.length} more to show scores.`
                        : "No ratings yet — be the first!"}
                    </p>
                  )}
                  <button onClick={() => setShowAgentRating(!showAgentRating)}
                    className="bg-[#1ec6a4]/10 border border-[#1ec6a4]/25 text-[#1ec6a4] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#1ec6a4]/20 transition-colors w-full">
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
              </div>
            ) : (
              <p className="text-[rgba(255,255,255,0.3)] text-sm">No managing agent recorded yet.</p>
            )}
          </Card>

          {/* Freeholder */}
          <Card title="Freeholder">
            {freeholder ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">{freeholder.name}</span>
                  {link && confidenceBadge(link.freeholder_confidence)}
                </div>
                {freeholder.parent_company && (
                  <p className="text-xs text-[rgba(255,255,255,0.3)] mb-1">Part of {freeholder.parent_company}</p>
                )}
                {link?.freeholder_source && (
                  <p className="text-xs text-[rgba(255,255,255,0.3)] mb-3">Source: {link.freeholder_source}</p>
                )}
                <ContactDetails phone={freeholder.phone} email={freeholder.email} address={freeholder.address} />

                {/* Inline rating */}
                <div className="mt-4 pt-4 border-t border-[#1e3a5f]">
                  {fhAgg ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xl font-bold ${ratingColor(fhAgg.overall)}`}>{fhAgg.overall.toFixed(1)}</span>
                        <span className="text-xs text-[rgba(255,255,255,0.3)]">/ 5.0 · {allFhRatings.length} ratings</span>
                      </div>
                      <div className="space-y-1.5">
                        {FH_CATS.map(c => (
                          <div key={c} className="flex items-center gap-2 text-xs">
                            <span className="w-28 text-[rgba(255,255,255,0.45)]">{FH_LABELS[c]}</span>
                            <div className="flex-1 h-1.5 bg-[#0f1f3d] rounded-full overflow-hidden">
                              <div className={`h-1.5 rounded-full ${ratingBarColor(fhAgg[c])}`} style={{ width: `${(fhAgg[c] / 5) * 100}%` }} />
                            </div>
                            <span className="w-5 text-right font-semibold text-white text-[11px]">{fhAgg[c].toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.3)] mb-2">
                      {allFhRatings.length > 0
                        ? `${allFhRatings.length} rating${allFhRatings.length !== 1 ? "s" : ""} — need ${3 - allFhRatings.length} more to show scores.`
                        : "No ratings yet — be the first!"}
                    </p>
                  )}
                  <button onClick={() => setShowFhRating(!showFhRating)}
                    className="bg-[#1ec6a4]/10 border border-[#1ec6a4]/25 text-[#1ec6a4] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#1ec6a4]/20 transition-colors w-full">
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
              </div>
            ) : (
              <p className="text-[rgba(255,255,255,0.3)] text-sm">No freeholder recorded yet.</p>
            )}
          </Card>
        </div>

        {/* ── Suggest correction ──────────────────────────────────────── */}
        <div className="text-center">
          <button onClick={() => setShowCorrection(!showCorrection)} className="text-xs text-[#1ec6a4] hover:underline">
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

        {/* ── Service Charges (Owner only) ────────────────────────────── */}
        {userStatus === "owner" && (
          <Card title="Service Charges">
            <div className="text-center py-6 border border-dashed border-[#1e3a5f] rounded-lg">
              <span className="text-2xl mb-2 block">💷</span>
              <p className="text-sm text-[rgba(255,255,255,0.55)] mb-1">Coming soon</p>
              <p className="text-xs text-[rgba(255,255,255,0.3)]">Upload and compare your service charge statements.</p>
            </div>
          </Card>
        )}

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

      </div>
    </div>
  );
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#132847] rounded-xl p-5 border border-[#1e3a5f]">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.3)] mb-3">{title}</h3>
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
