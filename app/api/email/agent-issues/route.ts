import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../../lib/email";
import { buildEmailHtml } from "../../../lib/email-template";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface IssueRow {
  id: string;
  title: string;
  category: string;
  description: string | null;
  created_at: string;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function categoryLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function buildIssueListHtml(issues: { issue: IssueRow; supporters: number }[]) {
  return issues
    .map(({ issue, supporters }) => {
      const dateLabel = new Date(issue.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const desc = issue.description
        ? issue.description.length > 220
          ? issue.description.slice(0, 217) + "…"
          : issue.description
        : "<em style=\"opacity:0.6\">No description provided.</em>";
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 12px 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
        <tr>
          <td style="padding: 14px 16px;">
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${escapeHtml(issue.title)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 8px;">
              ${escapeHtml(categoryLabel(issue.category))} · ${dateLabel} · ${supporters} supporter${supporters === 1 ? "" : "s"}
            </div>
            <div style="font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.55;">
              ${escapeHtml(desc)}
            </div>
          </td>
        </tr>
      </table>`;
    })
    .join("");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadIssuesForDevelopment(developmentId: string) {
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, category, description, created_at")
    .eq("development_id", developmentId)
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  if (!issues || issues.length === 0) return [];

  const enriched: { issue: IssueRow; supporters: number }[] = [];
  for (const issue of issues as IssueRow[]) {
    const { count } = await supabase
      .from("issue_supporters")
      .select("id", { count: "exact", head: true })
      .eq("issue_id", issue.id);
    enriched.push({ issue, supporters: count || 0 });
  }
  return enriched;
}

async function getOrCreateToken(managingAgentId: string, developmentId: string, email: string) {
  // Reuse an unexpired token if one exists
  const { data: existing } = await supabase
    .from("agent_tokens")
    .select("id, token, expires_at")
    .eq("managing_agent_id", managingAgentId)
    .eq("development_id", developmentId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return { id: existing[0].id, token: existing[0].token };
  }

  const { data: created, error } = await supabase
    .from("agent_tokens")
    .insert({ managing_agent_id: managingAgentId, development_id: developmentId, email })
    .select("id, token")
    .single();

  if (error || !created) throw new Error("Failed to create agent token: " + error?.message);
  return { id: created.id, token: created.token };
}

interface AgentTarget {
  developmentId: string;
  developmentName: string;
  developmentSlug: string;
  managingAgentId: string;
  managingAgentName: string;
  email: string;
}

async function loadTargets(slug?: string): Promise<AgentTarget[]> {
  // Find all (development, managing_agent) pairs with an email
  const devQuery = supabase
    .from("developments")
    .select("id, name, slug")
    .order("name");
  if (slug) devQuery.eq("slug", slug);
  const { data: devs } = await devQuery;
  if (!devs) return [];

  const targets: AgentTarget[] = [];
  for (const d of devs) {
    const { data: link } = await supabase
      .from("development_links")
      .select("managing_agent_id")
      .eq("development_id", d.id)
      .single();
    if (!link?.managing_agent_id) continue;

    const { data: agent } = await supabase
      .from("managing_agents")
      .select("id, name, email")
      .eq("id", link.managing_agent_id)
      .single();
    if (!agent?.email) continue;

    targets.push({
      developmentId: d.id,
      developmentName: d.name,
      developmentSlug: d.slug,
      managingAgentId: agent.id,
      managingAgentName: agent.name,
      email: agent.email,
    });
  }
  return targets;
}

async function sendDigestForTarget(t: AgentTarget, isFollowup: boolean) {
  const enriched = await loadIssuesForDevelopment(t.developmentId);
  if (enriched.length === 0) return { sent: false, reason: "no open issues" };

  const { id: tokenId, token } = await getOrCreateToken(t.managingAgentId, t.developmentId, t.email);

  const issueCount = enriched.length;
  const subject = isFollowup
    ? `Reminder: ${issueCount} issue${issueCount === 1 ? "" : "s"} at ${t.developmentName} still need a response`
    : `${issueCount} issue${issueCount === 1 ? "" : "s"} raised at ${t.developmentName} — your residents are asking for a response`;

  const intro = isFollowup
    ? `<p style="margin:0 0 12px 0;">Your residents at <strong style="color:#ffffff;">${escapeHtml(t.developmentName)}</strong> are still waiting to hear back. We sent you a digest a few days ago — here it is again, with the issues that still need a response.</p>`
    : `<p style="margin:0 0 12px 0;">Hi <strong style="color:#ffffff;">${escapeHtml(t.managingAgentName)}</strong> team,</p>
       <p style="margin:0 0 12px 0;">Residents at <strong style="color:#ffffff;">${escapeHtml(t.developmentName)}</strong> are using BlockVoice to track building issues. ${issueCount} issue${issueCount === 1 ? " has" : "s have"} been raised that need your attention.</p>`;

  const bodyHtml = `
    ${intro}
    <p style="margin:0 0 16px 0; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#1ec6a4; font-weight:700;">Open Issues</p>
    ${buildIssueListHtml(enriched)}
    <p style="margin:16px 0 0 0;">Click the button below to view and respond to these issues. No login required — your link is private to you.</p>
  `;

  const ctaUrl = `https://blockvoice.co.uk/agent/${token}`;
  const html = buildEmailHtml({
    title: isFollowup ? `Reminder: residents at ${t.developmentName} need a response` : `Issues at ${t.developmentName}`,
    bodyHtml,
    ctaText: "View & respond to issues →",
    ctaUrl,
  });

  const result = await sendEmail({
    to: t.email,
    subject,
    html,
    profileId: null,
    emailType: isFollowup ? "agent_issues_followup" : "agent_issues_digest",
    metadata: {
      managing_agent_id: t.managingAgentId,
      development_id: t.developmentId,
      development_slug: t.developmentSlug,
      agent_token_id: tokenId,
      issue_count: issueCount,
    },
  });

  return { sent: result.success, error: result.success ? undefined : result.error };
}

// ─── POST: manual trigger ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { secret, slug } = await req.json().catch(() => ({}));

  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targets = await loadTargets(slug);
  const results: { sent: number; skipped: number; errors: string[] } = { sent: 0, skipped: 0, errors: [] };

  for (const t of targets) {
    // Dedup guard — skip if we sent a digest to this agent+dev in the last 6 days
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("email_log")
      .select("id")
      .eq("email_type", "agent_issues_digest")
      .gte("sent_at", sixDaysAgo)
      .contains("metadata", { managing_agent_id: t.managingAgentId, development_id: t.developmentId })
      .limit(1);

    if (recent && recent.length > 0) {
      results.skipped++;
      continue;
    }

    try {
      const r = await sendDigestForTarget(t, false);
      if (r.sent) results.sent++;
      else if (r.reason) results.skipped++;
      else if (r.error) results.errors.push(`${t.developmentName}: ${r.error}`);
    } catch (e) {
      results.errors.push(`${t.developmentName}: ${String(e)}`);
    }
  }

  return NextResponse.json(results);
}

// ─── GET: cron trigger ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isCron = req.nextUrl.searchParams.get("cron") === "true";
  const isFollowup = req.nextUrl.searchParams.get("followup") === "true";
  const authHeader = req.headers.get("authorization");

  if (!isCron) {
    return NextResponse.json({ error: "method not allowed" }, { status: 405 });
  }

  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targets = await loadTargets();
  const results: { sent: number; skipped: number; errors: string[] } = { sent: 0, skipped: 0, errors: [] };

  if (!isFollowup) {
    // ─── INITIAL Monday digest ───────────────────────────────────────────
    for (const t of targets) {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("email_log")
        .select("id")
        .eq("email_type", "agent_issues_digest")
        .eq("recipient_email", t.email)
        .gte("sent_at", sixDaysAgo)
        .contains("metadata", { development_id: t.developmentId })
        .limit(1);

      if (recent && recent.length > 0) {
        results.skipped++;
        continue;
      }

      try {
        const r = await sendDigestForTarget(t, false);
        if (r.sent) results.sent++;
        else results.skipped++;
      } catch (e) {
        results.errors.push(`${t.developmentName}: ${String(e)}`);
      }
    }
    return NextResponse.json(results);
  }

  // ─── FOLLOW-UP (Thursday) ─────────────────────────────────────────────
  // Find all initial digests sent in the last 4 days that haven't been responded to.
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSends } = await supabase
    .from("email_log")
    .select("recipient_email, sent_at, metadata")
    .eq("email_type", "agent_issues_digest")
    .eq("status", "sent")
    .gte("sent_at", fourDaysAgo)
    .order("sent_at", { ascending: false });

  if (!recentSends || recentSends.length === 0) {
    return NextResponse.json({ ...results, reason: "no recent digests to follow up on" });
  }

  // Dedup recentSends by (managing_agent_id, development_id) — keep only the
  // most recent digest per pair (the array is already sorted DESC by sent_at)
  const seen = new Set<string>();
  const uniqueSends: typeof recentSends = [];
  for (const s of recentSends) {
    const meta = (s.metadata || {}) as Record<string, string>;
    const key = `${meta.managing_agent_id}|${meta.development_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSends.push(s);
  }

  for (const send of uniqueSends) {
    const meta = (send.metadata || {}) as Record<string, string | number>;
    const tokenId = meta.agent_token_id as string | undefined;
    const developmentId = meta.development_id as string | undefined;
    const managingAgentId = meta.managing_agent_id as string | undefined;
    if (!tokenId || !developmentId || !managingAgentId) continue;

    // Has this agent already responded to ANY issue since the original send?
    const { data: responses } = await supabase
      .from("agent_responses")
      .select("id")
      .eq("agent_token_id", tokenId)
      .gte("created_at", send.sent_at)
      .limit(1);

    if (responses && responses.length > 0) {
      results.skipped++;
      continue;
    }

    // Dedup follow-ups themselves — skip if we sent one in the last 4 days
    // Match by (managing_agent_id, development_id) in metadata, not recipient_email,
    // because the agent's email may have changed between sends.
    const { data: recentFollowup } = await supabase
      .from("email_log")
      .select("id")
      .eq("email_type", "agent_issues_followup")
      .gte("sent_at", fourDaysAgo)
      .contains("metadata", { managing_agent_id: managingAgentId, development_id: developmentId })
      .limit(1);

    if (recentFollowup && recentFollowup.length > 0) {
      results.skipped++;
      continue;
    }

    // Resolve the target details
    const { data: dev } = await supabase
      .from("developments")
      .select("id, name, slug")
      .eq("id", developmentId)
      .single();
    const { data: agent } = await supabase
      .from("managing_agents")
      .select("id, name, email")
      .eq("id", managingAgentId)
      .single();
    if (!dev || !agent?.email) {
      results.skipped++;
      continue;
    }

    const target: AgentTarget = {
      developmentId: dev.id,
      developmentName: dev.name,
      developmentSlug: dev.slug,
      managingAgentId: agent.id,
      managingAgentName: agent.name,
      email: agent.email,
    };

    try {
      const r = await sendDigestForTarget(target, true);
      if (r.sent) results.sent++;
      else results.skipped++;
    } catch (e) {
      results.errors.push(`${target.developmentName}: ${String(e)}`);
    }
  }

  return NextResponse.json(results);
}
