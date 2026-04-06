import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  profileId?: string | null;
  emailType?: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail({ to, subject, html, profileId, emailType, metadata }: SendEmailParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: "BlockVoice <hello@blockvoice.co.uk>",
      to,
      subject,
      html,
    });

    if (emailType) {
      await getSupabaseAdmin().from("email_log").insert({
        profile_id: profileId ?? null,
        recipient_email: to,
        email_type: emailType,
        subject,
        status: error ? "failed" : "sent",
        metadata: metadata ?? null,
      });
    }

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send exception:", err);

    if (emailType) {
      await getSupabaseAdmin().from("email_log").insert({
        profile_id: profileId ?? null,
        recipient_email: to,
        email_type: emailType,
        subject,
        status: "failed",
        metadata: metadata ?? null,
      });
    }

    return { success: false, error: String(err) };
  }
}
