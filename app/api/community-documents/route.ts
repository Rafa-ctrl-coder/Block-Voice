import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DOC_TYPES, DocType } from "@/app/lib/doc-prompts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DocTypeRow {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  icon: string | null;
}

/**
 * GET /api/community-documents?profile_id=XXX[&doc_type=YYY]
 *
 * Returns three lists in one response:
 *   - ownDocuments: all rows uploaded by this profile (any status)
 *                   — includes personal_analysis and community_summary
 *   - feed:         shared rows at the same development as the caller
 *                   — personal_analysis and storage_path are EXCLUDED
 *   - progress:     7 rows { doc_type, label, shared_count }
 *                   — drives the "shared vs missing" tracker UI
 *   - types:        the 7 document type definitions
 *
 * This route bypasses RLS using the service role, but enforces the development
 * boundary manually via the caller's profile_id → buildings.development_name.
 */
export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profile_id");
    const docTypeFilter = req.nextUrl.searchParams.get("doc_type");

    if (!profileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }

    // Resolve caller's development_name via profiles → buildings
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, building_id")
      .eq("id", profileId)
      .single();

    if (!profile || !profile.building_id) {
      return NextResponse.json(
        { error: "Profile has no building" },
        { status: 404 }
      );
    }

    const { data: building } = await supabase
      .from("buildings")
      .select("id, development_name")
      .eq("id", profile.building_id)
      .single();

    const developmentName = building?.development_name || null;

    // ---- Document types ----
    const { data: types } = await supabase
      .from("community_document_types")
      .select("*")
      .order("sort_order", { ascending: true });

    const typeList: DocTypeRow[] = (types as DocTypeRow[]) || [];

    // ---- Own documents ----
    const ownQuery = supabase
      .from("community_documents")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (docTypeFilter) ownQuery.eq("doc_type", docTypeFilter);

    const { data: ownDocumentsRaw } = await ownQuery;
    const ownDocuments = ownDocumentsRaw || [];

    // ---- Community feed (shared docs at the caller's development) ----
    let feed: Record<string, unknown>[] = [];
    const progressMap: Record<string, number> = {};
    for (const t of DOC_TYPES) progressMap[t] = 0;

    if (developmentName) {
      const feedQuery = supabase
        .from("community_documents")
        .select(
          "id, profile_id, doc_type, original_filename, community_summary, is_shared, shared_at, champion_handle, document_date, created_at"
        )
        .eq("development_name", developmentName)
        .eq("is_shared", true)
        .order("shared_at", { ascending: false });

      if (docTypeFilter) feedQuery.eq("doc_type", docTypeFilter);

      const { data: feedRaw } = await feedQuery;
      feed = feedRaw || [];

      // Progress map — count shared docs per type (ignore docTypeFilter here
      // so the tracker always reflects the full picture)
      const { data: progressRows } = await supabase
        .from("community_documents")
        .select("doc_type")
        .eq("development_name", developmentName)
        .eq("is_shared", true);

      for (const row of progressRows || []) {
        const t = row.doc_type as DocType;
        if (t in progressMap) progressMap[t]++;
      }
    }

    const progress = typeList.map((t) => ({
      doc_type: t.id,
      label: t.label,
      description: t.description,
      icon: t.icon,
      sort_order: t.sort_order,
      shared_count: progressMap[t.id] || 0,
    }));

    return NextResponse.json({
      developmentName,
      types: typeList,
      ownDocuments,
      feed,
      progress,
    });
  } catch (err) {
    console.error("Feed route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load documents" },
      { status: 500 }
    );
  }
}
