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

    // fetch link (agent + freeholder)
    const { data: linkData } = await supabase
      .from("development_links")
      .select("*, managing_agents(*), freeholders(*)")
      .eq("development_id", devData.id)
      .single();
    if (linkData) setLink(linkData as LinkRow);

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

  // -- render -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white">
      <Nav />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-1">
            {dev.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[rgba(255,255,255,0.55)]">
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
          <p className="text-sm text-[rgba(255,255,255,0.3)] mt-2">
            {residentCount !== null ? `${residentCount} resident${residentCount !== 1 ? "s" : ""} joined` : "●●● residents joined"}
          </p>
        </div>

        {/* ── Managing Agent ──────────────────────────────────────────── */}
        <Card title="Managing Agent">
          {agent ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">{agent.name}</span>
                {link && confidenceBadge(link.agent_confidence)}
              </div>
              {link?.agent_source && (
                <p className="text-xs text-[rgba(255,255,255,0.3)] mb-3">
                  Source: {link.agent_source}
                </p>
              )}
              {authed ? (
                <ContactDetails
                  phone={agent.phone}
                  email={agent.email}
                  website={agent.website}
                  address={agent.address}
                />
              ) : (
                <LockedRow label="Sign up to see contact details" slug={slug} />
              )}
            </div>
          ) : (
            <p className="text-[rgba(255,255,255,0.3)] text-sm">
              No managing agent recorded yet.
            </p>
          )}
        </Card>

        {/* ── Freeholder ──────────────────────────────────────────────── */}
        <Card title="Freeholder">
          {freeholder ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">
                  {freeholder.name}
                </span>
                {link && confidenceBadge(link.freeholder_confidence)}
              </div>
              {freeholder.parent_company && (
                <p className="text-xs text-[rgba(255,255,255,0.3)] mb-1">
                  Part of {freeholder.parent_company}
                </p>
              )}
              {link?.freeholder_source && (
                <p className="text-xs text-[rgba(255,255,255,0.3)] mb-3">
                  Source: {link.freeholder_source}
                </p>
              )}
              {authed ? (
                <ContactDetails
                  phone={freeholder.phone}
                  email={freeholder.email}
                  address={freeholder.address}
                />
              ) : (
                <LockedRow label="Sign up to see contact details" slug={slug} />
              )}
            </div>
          ) : (
            <p className="text-[rgba(255,255,255,0.3)] text-sm">
              No freeholder recorded yet.
            </p>
          )}
        </Card>

        {/* ── Blocks ──────────────────────────────────────────────────── */}
        {blocks.length > 0 && (
          <Card title="Blocks">
            <div className="flex flex-wrap gap-2">
              {blocks.map((b) => (
                <span
                  key={b.id}
                  className="bg-[#162d50] text-[rgba(255,255,255,0.7)] text-xs px-3 py-1.5 rounded-lg"
                >
                  {b.name}
                  <span className="text-[rgba(255,255,255,0.3)] ml-1">
                    · {b.total_units} units
                  </span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* ── Issues ──────────────────────────────────────────────────── */}
        <Card
          title={
            issueCount > 0
              ? `${issueCount} open issue${issueCount !== 1 ? "s" : ""} raised by residents`
              : "No open issues"
          }
        >
          {issues.length === 0 ? (
            <p className="text-[rgba(255,255,255,0.3)] text-sm">
              No issues have been raised yet.
            </p>
          ) : authed ? (
            /* ── GATED: full issue list ── */
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-white text-sm">
                      <span className="mr-1.5">
                        {CATEGORY_EMOJI[issue.category] || "📋"}
                      </span>
                      {issue.title}
                    </h4>
                    {statusBadge(issue.status)}
                  </div>
                  {issue.description && (
                    <p className="text-[rgba(255,255,255,0.55)] text-xs mt-1 mb-2">
                      {issue.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[rgba(255,255,255,0.3)]">
                    <span>
                      {issue.supporter_count}{" "}
                      {issue.supporter_count === 1 ? "resident" : "residents"}
                    </span>
                    <span>
                      {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── PUBLIC: teaser list ── */
            <div className="relative">
              <div className="space-y-2">
                {issues.slice(0, 3).map((issue, i) => (
                  <div
                    key={issue.id}
                    className={`flex items-center gap-2 text-sm ${i >= 2 ? "opacity-40" : ""}`}
                  >
                    <span>{CATEGORY_EMOJI[issue.category] || "📋"}</span>
                    <span className="text-[rgba(255,255,255,0.7)]">
                      {truncate(issue.title, 60)}
                    </span>
                  </div>
                ))}
              </div>
              {issues.length > 2 && (
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-900 to-transparent flex items-end justify-center pb-1">
                  <span className="text-xs text-[rgba(255,255,255,0.55)]">
                    Sign up to see all issues and add your voice
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Correction link (authed only) ───────────────────────────── */}
        {authed && (
          <p className="text-center text-sm text-[rgba(255,255,255,0.3)]">
            Something wrong?{" "}
            <button className="text-[#1ec6a4] hover:underline">
              Suggest a correction
            </button>
          </p>
        )}

        {/* ── CTA (public) ────────────────────────────────────────────── */}
        {!authed && (
          <div className="bg-[#132847] rounded-xl p-6 text-center border border-[#1e3a5f]">
            <Link
              href={`/signup?building=${slug}`}
              className="block w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-3.5 rounded-xl font-bold text-base"
            >
              Sign up free to see full details and raise issues
            </Link>
            <p className="text-xs text-[rgba(255,255,255,0.3)] mt-3">
              Join residents at {dev.name} · Free forever · 30 seconds
            </p>
          </div>
        )}
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
