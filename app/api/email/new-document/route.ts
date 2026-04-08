import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/app/lib/email";
import { buildEmailHtml } from "@/app/lib/email-template";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/email/new-document
 *
 * Body: { document_id, development_name, uploader_profile_id }
 *
 * Notifies all residents at the same development (except the uploader) that a
 * new community document has been shared. Dedups per-recipient: one email per
 * user per 24 hours at most.
 *
 * FEATURE FLAGGED: this route is a no-op unless COMMUNITY_EMAIL_ENABLED=true.
 * Matches the opt-out-first posture used for the currently-disabled
 * new-issue email notifications.
 */
export async function POST(req: NextRequest) {
  if (process.env.COMMUNITY_EMAIL_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "COMMUNITY_EMAIL_ENABLED not set" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      document_id: documentId,
      development_name: developmentName,
      uploader_profile_id: uploaderProfileId,
    } = body as {
      document_id?: string;
      development_name?: string;
      uploader_profile_id?: string;
    };

    if (!documentId || !developmentName || !uploaderProfileId) {
      return NextResponse.json(
        { error: "document_id, development_name, uploader_profile_id required" },
        { status: 400 }
      );
    }

    // Fetch the newly-shared doc + recent shared docs (24h) for a mini-digest
    const { data: doc } = await supabase
      .from("community_documents")
      .select("id, doc_type, champion_handle, shared_at")
      .eq("id", documentId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: docType } = await supabase
      .from("community_document_types")
      .select("label")
      .eq("id", doc.doc_type)
      .single();

    const typeLabel = docType?.label || doc.doc_type;
    const championHandle = doc.champion_handle || "A neighbour";

    // All residents at this development, excluding the uploader
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("development_name", developmentName);

    const buildingIds = (buildings || []).map((b) => b.id);
    if (buildingIds.length === 0) {
      return NextResponse.json({ sent: 0, reason: "No buildings in development" });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, email")
      .in("building_id", buildingIds)
      .neq("id", uploaderProfileId);

    const recipients = (profiles || []).filter(
      (p): p is { id: string; first_name: string | null; email: string } =>
        typeof p.email === "string" && p.email.length > 0
    );

    // Dedup: skip anyone who received a new_community_document email in the last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLog } = await supabase
      .from("email_log")
      .select("recipient_email")
      .eq("email_type", "new_community_document")
      .gte("sent_at", since);

    const recentRecipients = new Set(
      (recentLog || []).map((r) => (r.recipient_email || "").toLowerCase())
    );

    const toSend = recipients.filter((r) => !recentRecipients.has(r.email.toLowerCase()));

    let sent = 0;
    let failed = 0;

    for (const recipient of toSend) {
      const firstName = recipient.first_name || "there";
      const body = `
        <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(firstName)},</p>
        <p style="margin: 0 0 12px 0;">
          <strong>${escapeHtml(championHandle)}</strong> — one of your neighbours at
          <strong>${escapeHtml(developmentName)}</strong> — has just shared a
          <strong>${escapeHtml(typeLabel)}</strong> with the building community.
        </p>
        <p style="margin: 0 0 12px 0;">
          BlockVoice has extracted a redacted summary (no names, flat numbers, or personal details)
          so everyone in the building can learn from it.
        </p>
        <p style="margin: 0 0 12px 0;">
          More residents sharing means better collective understanding of your building.
          You can become a community champion too — upload any building document and you decide
          whether to share it.
        </p>
      `;

      const html = buildEmailHtml({
        title: `${championHandle} shared a ${typeLabel} at ${developmentName}`,
        bodyHtml: body,
        ctaText: "Read on BlockVoice",
        ctaUrl: "https://blockvoice.co.uk/dashboard",
      });

      const result = await sendEmail({
        to: recipient.email,
        subject: `New ${typeLabel} shared at ${developmentName}`,
        html,
        profileId: recipient.id,
        emailType: "new_community_document",
        metadata: { document_id: documentId, doc_type: doc.doc_type },
      });

      if (result.success) sent++;
      else failed++;

      // Light pacing
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({ sent, failed, skipped: recipients.length - toSend.length });
  } catch (err) {
    console.error("new-document email route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send notifications" },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
