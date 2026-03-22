import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "../../lib/email";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, message } = await req.json();
    if (!userId || !message) {
      return NextResponse.json({ error: "userId and message required" }, { status: 400 });
    }

    // Look up profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, building_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Look up building → development
    let devName = "Unknown development";
    if (profile.building_id) {
      const { data: building } = await supabase
        .from("buildings")
        .select("development_name")
        .eq("id", profile.building_id)
        .single();
      if (building?.development_name) devName = building.development_name;
    }

    const name = `${profile.first_name} ${profile.last_name}`;
    const subject = `Dashboard feedback from ${name} at ${devName}`;

    await sendEmail({
      to: "hello@blockvoice.co.uk",
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px;">
          <h2 style="color: #0f1f3d;">Feedback from ${name}</h2>
          <p style="color: #666;"><strong>Development:</strong> ${devName}</p>
          <p style="color: #666;"><strong>Email:</strong> ${profile.email}</p>
          <hr style="border: 1px solid #eee;" />
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="color: #333; white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
          <p style="color: #999; font-size: 12px;">Sent via BlockVoice dashboard feedback</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
