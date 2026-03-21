import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  profileId?: string;
  emailType?: string;
}

export async function sendEmail({ to, subject, html, profileId, emailType }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: "BlockVoice <hello@blockvoice.co.uk>",
      to,
      subject,
      html,
    });

    // Log the send attempt
    if (profileId && emailType) {
      await supabaseAdmin.from("email_log").insert({
        profile_id: profileId,
        email_type: emailType,
        subject,
        status: error ? "failed" : "sent",
      }); // don't fail if logging fails
    }

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send exception:", err);

    if (profileId && emailType) {
      await supabaseAdmin.from("email_log").insert({
        profile_id: profileId,
        email_type: emailType,
        subject,
        status: "failed",
      });
    }

    return { success: false, error: String(err) };
  }
}
