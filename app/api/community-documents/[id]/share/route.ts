import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * PATCH /api/community-documents/[id]/share
 *
 * Body: { profile_id: string, share: boolean }
 *
 * Flips is_shared on a community document. On first share, assigns a stable
 * champion_handle ("Resident A/B/C…") derived from the number of distinct
 * sharers at the same development. If the same profile has previously shared
 * any document at the same development, their existing handle is reused.
 *
 * When sharing, triggers a fire-and-forget notification email — the email
 * route itself is gated behind COMMUNITY_EMAIL_ENABLED and will no-op when
 * the flag is unset.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { profile_id: profileId, share } = body as { profile_id?: string; share?: boolean };

    if (!id || !profileId || typeof share !== "boolean") {
      return NextResponse.json(
        { error: "id, profile_id, share required" },
        { status: 400 }
      );
    }

    // Ownership check
    const { data: doc } = await supabase
      .from("community_documents")
      .select("id, profile_id, development_name, status, is_shared, champion_handle")
      .eq("id", id)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (doc.profile_id !== profileId) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }
    if (doc.status !== "ready") {
      return NextResponse.json(
        { error: "Document is not ready to share" },
        { status: 400 }
      );
    }

    // Unshare path
    if (!share) {
      const { data: updated } = await supabase
        .from("community_documents")
        .update({ is_shared: false })
        .eq("id", id)
        .select()
        .single();
      return NextResponse.json({ success: true, document: updated });
    }

    // Share path — compute or reuse champion_handle
    let championHandle: string | null = doc.champion_handle;

    if (!championHandle) {
      // Reuse if the profile already has a shared doc at this development
      const { data: existing } = await supabase
        .from("community_documents")
        .select("champion_handle")
        .eq("profile_id", profileId)
        .eq("development_name", doc.development_name)
        .eq("is_shared", true)
        .not("champion_handle", "is", null)
        .limit(1)
        .maybeSingle();

      if (existing?.champion_handle) {
        championHandle = existing.champion_handle;
      } else {
        // Count distinct other sharers at this dev to pick the next letter
        const { data: otherSharers } = await supabase
          .from("community_documents")
          .select("profile_id")
          .eq("development_name", doc.development_name)
          .eq("is_shared", true)
          .neq("profile_id", profileId);

        const distinctSharers = new Set((otherSharers || []).map((r) => r.profile_id)).size;
        championHandle = `Resident ${letterFor(distinctSharers)}`;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("community_documents")
      .update({
        is_shared: true,
        shared_at: new Date().toISOString(),
        champion_handle: championHandle,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to flip is_shared:", updateError);
      return NextResponse.json(
        { error: "Failed to share document" },
        { status: 500 }
      );
    }

    // Fire-and-forget: notify other residents. Route is feature-flagged.
    if (process.env.COMMUNITY_EMAIL_ENABLED === "true") {
      const origin = req.nextUrl.origin;
      fetch(`${origin}/api/email/new-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: id,
          development_name: doc.development_name,
          uploader_profile_id: profileId,
        }),
      }).catch((err) => console.error("new-document email dispatch failed:", err));
    }

    return NextResponse.json({ success: true, document: updated });
  } catch (err) {
    console.error("Share route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Share failed" },
      { status: 500 }
    );
  }
}

/**
 * Maps 0 → "A", 1 → "B", … 25 → "Z", 26 → "AA", 27 → "AB", …
 * Stable letter assignment for champion handles per development.
 */
function letterFor(n: number): string {
  if (n < 0) return "A";
  if (n < 26) return String.fromCharCode(65 + n);
  // 26+ → AA, AB, …
  const first = Math.floor(n / 26) - 1;
  const second = n % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}
