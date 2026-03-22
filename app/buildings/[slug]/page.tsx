"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import type {
  Development,
  Block,
  ManagingAgent,
  Freeholder,
  DevelopmentLink,
  ConfidenceLevel,
  IssueStatus,
  IssueCategory,
} from "../../lib/database.types";

// -- helpers ------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
  facilities: "🏢",
  maintenance: "🔧",
  service_charge: "💷",
  security: "🔒",
  safety: "⚠️",
  communal_areas: "🏠",
  communication: "📢",
  other: "📋",
};

function confidenceBadge(level: ConfidenceLevel) {
  const styles: Record<ConfidenceLevel, string> = {
    confirmed: "bg-green-900/60 text-green-400",
    high: "bg-indigo-900/60 text-indigo-300",
    medium: "bg-amber-900/60 text-amber-400",
    low: "bg-red-900/60 text-red-400",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function statusBadge(status: IssueStatus) {
  const styles: Record<IssueStatus, string> = {
    new: "bg-indigo-900/60 text-indigo-300",
    acknowledged: "bg-amber-900/60 text-amber-400",
    in_progress: "bg-blue-900/60 text-blue-300",
    resolved: "bg-green-900/60 text-green-400",
    escalated: "bg-red-900/60 text-red-400 ring-1 ring-red-500/40",
  };
  const labels: Record<IssueStatus, string> = {
    new: "New",
    acknowledged: "Acknowledged",
    in_progress: "In Progress",
    resolved: "Resolved",
    escalated: "Escalated",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// -- types for fetched data ---------------------------------------------------

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  status: IssueStatus;
  created_at: string;
  raised_by: string;
  supporter_count: number;
}

interface LinkRow extends DevelopmentLink {
  managing_agents: ManagingAgent | null;
  freeholders: Freeholder | null;
}

// -- page component -----------------------------------------------------------

export default function BuildingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(true);
  const [dev, setDev] = useState<Development | null>(null);
  const [link, setLink] = useState<LinkRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const [residentCount, setResidentCount] = useState<number | null>(null);
  const [authed, setAuthed] = useState(false);
  const [userDevId, setUserDevId] = useState<string | null>(null);
  const [scStats, setScStats] = useState<{ hasData: boolean; avgPerSqft?: number; avgMonthly?: number; lastYoYPct?: number | null; trend?: string } | null>(null);
  const [agentRating, setAgentRating] = useState<{ score: number; count: number } | null>(null);
  const [fhRating, setFhRating] = useState<{ score: number; count: number } | null>(null);

  useEffect(() => {
    if (slug) loadPage();
  }, [slug]);

  async function loadPage() {
    setLoading(true);

    // auth check (non-blocking — page still renders for public)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setAuthed(true);
      // check if user belongs to this development (via old profiles table)
      const { data: profile } = await supabase
        .from("profiles")
        .select("building_id")
        .eq("id", user.id)
        .single();
      if (profile) setUserDevId(profile.building_id);
    }

    // fetch development by slug
    const { data: devData } = await supabase
      .from("developments")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!devData) {
      setDev(null);
      setLoading(false);
      return;
    }
    setDev(devData);

    // fetch resident count via server API (bypasses RLS)
    try {
      const statsRes = await fetch(`/api/dev-stats?slug=${encodeURIComponent(slug)}`);
      const stats = await statsRes.json();
      setResidentCount(stats.residentCount || 0);
    } catch { /* stays null */ }

    // fetch SC stats
    try {
      const scRes = await fetch(`/api/sc-stats?slug=${encodeURIComponent(slug)}`);
      const sc = await scRes.json();
      setScStats(sc);
    } catch { /* no SC data */ }

    // fetch link (agent + freeholder)
    const { data: linkData } = await supabase
      .from("development_links")
      .select("*, managing_agents(*), freeholders(*)")
      .eq("development_id", devData.id)
      .single();
    if (linkData) {
      setLink(linkData as LinkRow);

      // fetch aggregate ratings for agent and freeholder
      if (linkData.managing_agent_id) {
        const { data: agentRatings } = await supabase
          .from("agent_ratings")
          .select("responsiveness, communication, value_for_money, maintenance, transparency")
          .eq("development_id", devData.id);
        if (agentRatings && agentRatings.length >= 3) {
          const avg = agentRatings.reduce((sum, r) => {
            const s = (r.responsiveness + r.communication + r.value_for_money + r.maintenance + r.transparency) / 5;
            return sum + s;
          }, 0) / agentRatings.length;
          setAgentRating({ score: Math.round(avg * 10) / 10, count: agentRatings.length });
        }
      }
      if (linkData.freeholder_id) {
        const { data: fhRatings } = await supabase
          .from("freeholder_ratings")
          .select("building_investment, leaseholder_relations, transparency, accountability")
          .eq("development_id", devData.id);
        if (fhRatings && fhRatings.length >= 3) {
          const avg = fhRatings.reduce((sum, r) => {
            const s = (r.building_investment + r.leaseholder_relations + r.transparency + r.accountability) / 4;
            return sum + s;
          }, 0) / fhRatings.length;
          setFhRating({ score: Math.round(avg * 10) / 10, count: fhRatings.length });
        }
      }
    }

    // fetch blocks
    const { data: blockData } = await supabase
      .from("blocks")
      .select("*")
      .eq("development_id", devData.id)
      .order("name");
    if (blockData) setBlocks(blockData);

    // fetch issues
    const { data: issueData, count } = await supabase
      .from("issues")
      .select("id, title, description, category, status, created_at, raised_by", {
        count: "exact",
      })
      .eq("development_id", devData.id)
      .neq("status", "resolved")
      .order("created_at", { ascending: false });

    if (issueData) {
      // get supporter counts
      const withCounts = await Promise.all(
        issueData.map(async (issue) => {
          const { count: sc } = await supabase
            .from("issue_supporters")
            .select("*", { count: "exact", head: true })
            .eq("issue_id", issue.id);
          return { ...issue, supporter_count: (sc || 0) + 1 } as IssueRow;
        })
      );
      setIssues(withCounts);
    }
    setIssueCount(count || 0);
    setLoading(false);
  }

  // -- loading state ----------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex items-center justify-center">
        <p className="text-[rgba(255,255,255,0.55)]">Loading building details…</p>
      </div>
    );
  }

  // -- not found --------------------------------------------------------------

  if (!dev) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white">
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Building not found</h1>
          <p className="text-[rgba(255,255,255,0.55)] mb-6">
            We don't have a listing for this building yet.
          </p>
          <Link
            href="/buildings/new"
            className="inline-block bg-[#1ec6a4] hover:bg-[#25d4b0] text-white px-6 py-3 rounded-lg font-semibold"
          >
            Add your building
          </Link>
        </div>
      </div>
    );
  }

  const agent = link?.managing_agents ?? null;
  const freeholder = link?.freeholders ?? null;
  const teal = "#1ec6a4";
  const postcode = dev.postcodes?.[0] || "";

  // -- render -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white">
      <Nav />

      <div className="max-w-[640px] mx-auto px-4 py-8">

        {/* ── Development header (centered, like join page) ──────────── */}
        <div className="text-center mb-7">
          <div className="text-[10px] uppercase tracking-[2px] font-bold mb-1" style={{ color: teal }}>Join your neighbours on BlockVoice</div>
          <h1 className="text-[30px] font-extrabold text-white mb-1.5">{dev.name}</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{postcode} · {dev.total_units} units{blocks.length > 0 ? ` · ${blocks.length} blocks` : ""}</p>
          <div className="flex justify-center gap-4 mt-3.5">
            <div className="rounded-lg px-4 py-2" style={{ background: "#1e293b", border: "1px solid #1e3a5f" }}>
              <span className="text-lg font-extrabold" style={{ color: teal }}>{residentCount ?? 0}</span>
              <span className="text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>residents joined</span>
            </div>
            <div className="rounded-lg px-4 py-2" style={{ background: "#1e293b", border: "1px solid #1e3a5f" }}>
              <span className="text-lg font-extrabold text-white">{issueCount}</span>
              <span className="text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>issues reported</span>
            </div>
          </div>
        </div>

        {/* ── What you'll see ────────────────────────────────────────── */}
        <div className="rounded-xl p-5 mb-4" style={{ background: "#1e293b", border: "1px solid #1e3a5f" }}>
          <h3 className="text-sm font-bold text-white mb-2.5">When you join, you&apos;ll see</h3>
          <div className="grid grid-cols-2 gap-1">
            {[
              agent ? `Managing agent: ${agent.name}` : "Managing agent details",
              freeholder ? `Freeholder: ${freeholder.name}` : "Freeholder details",
              "Service charge analysis",
              "All reported issues",
              "Your block details",
              "Invite & share tools",
            ].map(t => (
              <div key={t} className="flex items-center gap-1.5 py-1.5">
                <span className="text-xs" style={{ color: teal }}>✓</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{t}</span>
              </div>
            ))}
          </div>

          {/* Teaser ratings */}
          {(agentRating || fhRating) && (
          <div className="mt-3 pt-3 border-t border-[#1e3a5f]">
            <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Resident ratings</p>
            <div className="grid grid-cols-2 gap-2">
              {agent && (
              <div className="rounded-lg p-3" style={{ background: "#0f1f3d", border: "1px solid #1e3a5f" }}>
                <div className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{agent.name}</div>
                {agentRating ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-lg font-black ${agentRating.score >= 4 ? "text-green-400" : agentRating.score >= 2.5 ? "text-amber-400" : "text-red-400"}`}>{agentRating.score.toFixed(1)}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>/ 5.0</span>
                  </div>
                ) : (
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Not enough ratings yet</span>
                )}
              </div>
              )}
              {freeholder && (
              <div className="rounded-lg p-3" style={{ background: "#0f1f3d", border: "1px solid #1e3a5f" }}>
                <div className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{freeholder.name}</div>
                {fhRating ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-lg font-black ${fhRating.score >= 4 ? "text-green-400" : fhRating.score >= 2.5 ? "text-amber-400" : "text-red-400"}`}>{fhRating.score.toFixed(1)}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>/ 5.0</span>
                  </div>
                ) : (
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Not enough ratings yet</span>
                )}
              </div>
              )}
            </div>
            <p className="text-[10px] mt-2" style={{ color: teal }}>
              <Link href={`/signup?building=${slug}`} className="hover:underline">Sign up to see full ratings and add yours →</Link>
            </p>
          </div>
          )}
        </div>

        {/* ── Service charge snapshot teaser ──────────────────────────── */}
        {scStats?.hasData && (
        <div className="rounded-[14px] p-5 mb-4" style={{ background: "#1e293b", border: "1px solid rgba(30,198,164,0.15)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-white uppercase tracking-[1.5px]">Service charges in your building</span>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: "#fbbf24", color: "#412402" }}>BETA</span>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Residents at {dev.name} are already tracking their service charges on BlockVoice. Here&apos;s what they&apos;re seeing.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-[10px] p-3.5 text-center" style={{ background: "#0f1f3d", border: "1px solid #1e3a5f" }}>
              <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Current rate</div>
              <div className="text-2xl font-extrabold" style={{ color: teal }}>£{scStats.avgPerSqft?.toFixed(2)}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>per sqft / year</div>
            </div>
            {scStats.lastYoYPct != null && (
            <div className="rounded-[10px] p-3.5 text-center" style={{ background: scStats.lastYoYPct > 5 ? "rgba(248,113,113,0.06)" : "#0f1f3d", border: `1px solid ${scStats.lastYoYPct > 5 ? "rgba(248,113,113,0.15)" : "#1e3a5f"}` }}>
              <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Last year&apos;s change</div>
              <div className={`text-2xl font-extrabold ${scStats.lastYoYPct > 5 ? "text-red-400" : "text-amber-400"}`}>+{scStats.lastYoYPct.toFixed(1)}%</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>year on year</div>
            </div>
            )}
          </div>

          {/* Blurred YoY chart */}
          <div className="relative overflow-hidden rounded-[10px] mb-4" style={{ background: "#0f1f3d", border: "1px solid #1e3a5f" }}>
            <div className="flex items-end justify-center gap-6 h-20 px-8 pt-5 pb-3.5" style={{ filter: "blur(5px)", opacity: 0.4 }}>
              {[{ h: 22, c: "#fbbf24", y: "2023/24" }, { h: 42, c: "#f87171", y: "2024/25" }, { h: 62, c: "#f87171", y: "2025/26" }].map(b => (
                <div key={b.y} className="text-center">
                  <div className="w-[70px] mx-auto rounded-t" style={{ height: b.h, background: b.c }} />
                  <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{b.y}</div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="text-[13px] font-bold text-white mb-0.5">
                {scStats.trend === "accelerating" ? "Year-by-year growth is accelerating" : "See how your charges are trending"}
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Sign up to see the full breakdown</div>
            </div>
          </div>

          <Link href={`/signup?building=${slug}`}
            className="block w-full py-3.5 rounded-[10px] font-bold text-[15px] text-center text-white" style={{ background: teal }}>
            Join {dev.name} on BlockVoice — free
          </Link>
          <p className="text-[11px] text-center mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            Add your service charge to help build accurate data for fellow residents.
          </p>
        </div>
        )}

        {/* ── Join in 30 seconds CTA ─────────────────────────────────── */}
        {!authed && (
        <div className="rounded-xl p-5 mb-5 text-center" style={{ background: "#1e293b", border: "1px solid #1e3a5f" }}>
          <h3 className="text-[15px] font-bold text-white mb-1.5">Join in 30 seconds</h3>
          <p className="text-xs mb-3.5" style={{ color: "rgba(255,255,255,0.5)" }}>Tell us your apartment number and whether you&apos;re an owner or tenant. That&apos;s it.</p>
          <Link href={`/signup?building=${slug}`}
            className="inline-block font-bold text-[14px] px-8 py-3 rounded-[10px] text-white" style={{ background: teal }}>
            Sign up now
          </Link>
        </div>
        )}

        {/* ── Correction link (authed only) ───────────────────────────── */}
        {authed && (
          <p className="text-center text-sm text-[rgba(255,255,255,0.3)]">
            Something wrong?{" "}
            <button className="text-[#1ec6a4] hover:underline">
              Suggest a correction
            </button>
          </p>
        )}

        <div className="text-center py-5 text-[11px]" style={{ color: "#334155" }}>BlockVoice — Everything about your building. In one place.</div>
      </div>
    </div>
  );
}

// -- sub-components -----------------------------------------------------------

function Nav() {
  return (
    <nav className="flex justify-between items-center px-6 md:px-8 py-4 border-b border-[#1e3a5f]">
      <Link href="/" className="text-xl font-bold text-[#1ec6a4]">
        BlockVoice
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="text-sm text-[rgba(255,255,255,0.55)] hover:text-white"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="text-sm bg-[#1ec6a4] hover:bg-[#25d4b0] text-white px-4 py-1.5 rounded-lg font-semibold"
        >
          Join Now
        </Link>
      </div>
    </nav>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#132847] rounded-xl p-5 border border-[#1e3a5f]">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.3)] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function LockedRow({ label, slug }: { label: string; slug: string }) {
  return (
    <Link
      href={`/signup?building=${slug}`}
      className="flex items-center gap-2 bg-[#162d50]/50 hover:bg-[#1e3a5f]/60 rounded-lg px-4 py-3 mt-2 transition-colors cursor-pointer"
    >
      <svg
        className="w-4 h-4 text-[rgba(255,255,255,0.3)] flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="text-sm text-[#1ec6a4]">{label}</span>
    </Link>
  );
}

function ContactDetails({
  phone,
  email,
  website,
  address,
}: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}) {
  const rows = [
    phone && { label: "Phone", value: phone, href: `tel:${phone}` },
    email && { label: "Email", value: email, href: `mailto:${email}` },
    website && {
      label: "Website",
      value: website,
      href: website.startsWith("http") ? website : `https://${website}`,
    },
    address && { label: "Address", value: address },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  if (rows.length === 0) {
    return (
      <p className="text-[rgba(255,255,255,0.3)] text-sm mt-2">No contact details on file.</p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-2 text-sm">
          <span className="text-[rgba(255,255,255,0.3)] w-16 flex-shrink-0">{r.label}</span>
          {r.href ? (
            <a
              href={r.href}
              className="text-[#1ec6a4] hover:underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.value}
            </a>
          ) : (
            <span className="text-[rgba(255,255,255,0.7)] break-all">{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
