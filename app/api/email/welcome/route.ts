import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../../lib/email";
import { buildEmailHtml } from "../../../lib/email-template";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, email, building_id")
      .eq("id", userId)
      .single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Fetch building → development
    const { data: building } = await supabase
      .from("buildings")
      .select("development_name")
      .eq("id", profile.building_id)
      .single();

    let devName = building?.development_name || "your building";
    let agentName = "Unknown";
    let memberCount = 1;
    let issueCount = 0;

    if (building?.development_name) {
      // Fetch development details
      const { data: dev } = await supabase
        .from("developments")
        .select("id, name, total_units")
        .eq("name", building.development_name)
        .single();

      if (dev) {
        devName = dev.name;

        // Agent name
        const { data: link } = await supabase
          .from("development_links")
          .select("managing_agents(name)")
          .eq("development_id", dev.id)
          .single();
        if (link?.managing_agents) {
          agentName = (link.managing_agents as any).name;
        }

        // Member count
        const { data: devBuildings } = await supabase
          .from("buildings")
          .select("id")
          .eq("development_name", building.development_name);
        if (devBuildings && devBuildings.length > 0) {
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .in("building_id", devBuildings.map(b => b.id));
          memberCount = count || 1;
        }

        // Issue count
        const { count: ic } = await supabase
          .from("issues")
          .select("*", { count: "exact", head: true })
          .eq("development_id", dev.id)
          .neq("status", "resolved");
        issueCount = ic || 0;
      }
    }

    const bodyHtml = `
      <p style="color: #ffffff; margin: 0 0 16px 0;">Hi ${profile.first_name},</p>
      <p>Welcome to BlockVoice! You've joined <strong style="color: #ffffff;">${devName}</strong>.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; width: 100%;">
        <tr>
          <td style="padding: 12px 16px; background-color: #0f1f3d; border-radius: 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-size: 13px; color: rgba(255,255,255,0.5); padding: 4px 0;">
                  👥 <strong style="color: #ffffff;">${memberCount}</strong> resident${memberCount !== 1 ? "s" : ""} signed up so far
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: rgba(255,255,255,0.5); padding: 4px 0;">
                  📋 <strong style="color: #ffffff;">${issueCount}</strong> issue${issueCount !== 1 ? "s" : ""} reported
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: rgba(255,255,255,0.5); padding: 4px 0;">
                  🏢 Managing agent: <strong style="color: #ffffff;">${agentName}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p>You can now:</p>
      <p style="margin: 4px 0;">✓ See issues raised by your neighbours</p>
      <p style="margin: 4px 0;">✓ Report your own issues with evidence</p>
      <p style="margin: 4px 0;">✓ Support issues that affect you too</p>
      <p style="margin: 4px 0;">✓ Rate your managing agent and freeholder</p>

      <p style="margin-top: 20px; color: rgba(255,255,255,0.5); font-size: 13px;">
        Want to make your account more trustworthy? Verify your identity by uploading a document that proves you live at your address.
      </p>
    `;

    const html = buildEmailHtml({
      title: `Welcome to BlockVoice — you're in!`,
      bodyHtml,
      ctaText: "Go to your dashboard →",
      ctaUrl: "https://blockvoice.co.uk/dashboard",
      cta2Text: "Verify your identity →",
      cta2Url: "https://blockvoice.co.uk/verify",
    });

    const result = await sendEmail({
      to: profile.email,
      subject: "Welcome to BlockVoice — you're in!",
      html,
      profileId: userId,
      emailType: "welcome",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Welcome email error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
