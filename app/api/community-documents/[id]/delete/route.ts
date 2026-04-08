import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * DELETE /api/community-documents/[id]/delete
 *
 * Body: { profile_id: string }
 *
 * Deletes the uploader's document. Removes the file from storage and the row.
 * Ownership is enforced via the profile_id check.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const profileId = (body as { profile_id?: string }).profile_id;

    if (!id || !profileId) {
      return NextResponse.json(
        { error: "id and profile_id required" },
        { status: 400 }
      );
    }

    // Ownership check + grab storage_path
    const { data: doc } = await supabase
      .from("community_documents")
      .select("id, profile_id, storage_path")
      .eq("id", id)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (doc.profile_id !== profileId) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }

    // Remove the file from storage (best effort — fail-open)
    if (doc.storage_path && doc.storage_path !== "pending") {
      const { error: removeError } = await supabase.storage
        .from("community-documents")
        .remove([doc.storage_path]);
      if (removeError) {
        console.error("Failed to remove storage file:", removeError);
      }
    }

    // Delete the row
    const { error: deleteError } = await supabase
      .from("community_documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete community_documents row:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
