import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  // Get development
  const { data: dev } = await supabase
    .from("developments")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!dev) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Count residents across all buildings in this development
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id")
    .eq("development_name", dev.name);

  let residentCount = 0;
  if (buildings && buildings.length > 0) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("building_id", buildings.map(b => b.id));
    residentCount = count || 0;
  }

  // Count issues
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id")
    .eq("development_id", dev.id);

  let issueCount = 0;
  if (blocks && blocks.length > 0) {
    const { count } = await supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .in("block_id", blocks.map(b => b.id));
    issueCount = count || 0;
  }

  return NextResponse.json({ residentCount, issueCount });
}
