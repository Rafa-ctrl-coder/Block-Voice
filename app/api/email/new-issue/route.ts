import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../../lib/email";
import { buildEmailHtml } from "../../../lib/email-template";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_LABELS: Record<string, string> = {
  facilities: "Facilities", maintenance: "Maintenance", service_charge: "Service Charge",
  security: "Security", safety: "Safety", communal_areas: "Communal Areas",
  communication: "Communication", other: "Other",
};

export async function POST(req: NextRequest) {
  try {
    const { issueId, developmentId, reporterId } = await req.json();
    if (!issueId || !developmentId || !reporterId) {
      return NextResponse.json({ error: "issueId, developmentId, reporterId required" }, { status: 400 });
    }

    // Fetch issue details
    const { data: issue } = await supabase
      .from("issues")
      .select("title, description, category, block_id")
      .eq("id", issueId)
      .single();
    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    // Fetch development name
    const { data: dev } = await supabase
      .from("developments")
      .select("name")
      .eq("id", developmentId)
      .single();
    if (!dev) return NextResponse.json({ error: "Development not found" }, { status: 404 });

    // Fetch block name if applicable
    let blockName = "All blocks";
    if (issue.block_id) {
      const { data: block } = await supabase
        .from("blocks")
        .select("name")
        .eq("id", issue.block_id)
        .single();
      if (block) blockName = block.name;
    }

    // Find all profiles in the same development (excluding reporter)
    const { data: devBuildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("development_name", dev.name);
    if (!devBuildings || devBuildings.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, email")
      .in("building_id", devBuildings.map(b => b.id))
      .neq("id", reporterId);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Rate limit: check email_log for recent new_issue emails per user (max 1/hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let sent = 0;
    const descPreview = issue.description
      ? issue.description.length > 200
        ? issue.description.slice(0, 200) + "…"
        : issue.description
      : "";

    for (const profile of profiles) {
      // Check rate limit
      const { count } = await supabase
        .from("email_log")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("email_type", "new_issue")
        .gte("sent_at", oneHourAgo);

      if ((count || 0) > 0) continue; // skip — already emailed this hour

      const bodyHtml = `
        <p style="color: #ffffff; margin: 0 0 16px 0;">Hi ${profile.first_name},</p>
        <p>A new issue has been reported at <strong style="color: #ffffff;">${dev.name}</strong>:</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; width: 100%;">
          <tr>
            <td style="padding: 16px; background-color: #0f1f3d; border-radius: 8px; border-left: 3px solid #1ec6a4;">
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #ffffff;">${issue.title}</p>
              <p style="margin: 0 0 4px 0; font-size: 12px; color: rgba(255,255,255,0.4);">
                Category: <strong style="color: rgba(255,255,255,0.6);">${CATEGORY_LABELS[issue.category] || issue.category}</strong>
                &nbsp;·&nbsp;
                Block: <strong style="color: rgba(255,255,255,0.6);">${blockName}</strong>
              </p>
              ${descPreview ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.55);">${descPreview}</p>` : ""}
            </td>
          </tr>
        </table>

        <p>If this affects you too, log in and support this issue — the more residents who back it, the harder it is to ignore.</p>
      `;

      const html = buildEmailHtml({
        title: `New issue reported at ${dev.name}`,
        bodyHtml,
        ctaText: "View issue on your dashboard →",
        ctaUrl: "https://blockvoice.co.uk/dashboard",
      });

      const result = await sendEmail({
        to: profile.email,
        subject: `New issue reported at ${dev.name}`,
        html,
        profileId: profile.id,
        emailType: "new_issue",
      });

      if (result.success) sent++;
    }

    return NextResponse.json({ sent, total: profiles.length });
  } catch (err) {
    console.error("New issue email error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
