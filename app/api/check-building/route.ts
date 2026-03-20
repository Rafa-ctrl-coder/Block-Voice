import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const IDEAL_KEY = process.env.IDEAL_POSTCODES_KEY || process.env.NEXT_PUBLIC_IDEAL_POSTCODES_KEY;
export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "No postcode" }, { status: 400 });
  const cleaned = postcode.toUpperCase().replace(/\s+/g, "").replace(/^(.+?)(\d[A-Z]{2})$/, "$1 $2");
  const { data: buildings } = await supabase.from("buildings").select("id,name,total_flats").eq("postcode", cleaned);
  if (buildings && buildings.length > 0) {
    const unique = new Map();
    for (const b of buildings) {
      const key = b.name.trim().toLowerCase();
      if (!unique.has(key)) {
        const { count } = await supabase.from("issue_reports").select("*", { count: "exact", head: true }).eq("building_id", b.id);
        unique.set(key, { id: b.id, name: b.name.trim(), totalFlats: b.total_flats, issues: count || 0 });
      }
    }
    const buildingInfo = Array.from(unique.values());
    const totalIssues = buildingInfo.reduce((a, b) => a + b.issues, 0);
    return NextResponse.json({ found: true, existing: true, buildings: buildingInfo, totalIssues });
  }
  let apiBuildingName = "";
  let apiTotalFlats = 0;
  if (IDEAL_KEY) {
    try {
      const res = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(cleaned)}?api_key=${IDEAL_KEY}`);
      const data = await res.json();
      if (data.result && data.result.length > 0) {
        apiBuildingName = data.result[0].building_name || "";
        apiTotalFlats = data.result.length;
      }
    } catch {}
  }
  return NextResponse.json({
    found: false,
    existing: false,
    buildings: [],
    totalIssues: 0,
    suggested: { name: apiBuildingName, totalFlats: apiTotalFlats, postcode: cleaned }
  });
}
