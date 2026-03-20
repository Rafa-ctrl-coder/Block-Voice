import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const IDEAL_KEY = process.env.IDEAL_POSTCODES_KEY || process.env.NEXT_PUBLIC_IDEAL_POSTCODES_KEY;
export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "No postcode" }, { status: 400 });
  const cleaned = postcode.toUpperCase().replace(/\s+/g, "").replace(/^(.+?)(\d[A-Z]{2})$/, "$1 $2");
  const { data: buildings } = await supabase.from("buildings").select("id,name,total_flats,development_name").eq("postcode", cleaned);
  if (buildings && buildings.length > 0) {
    const devName = buildings.find(b => b.development_name && b.development_name !== "N/A")?.development_name || null;
    const displayName = devName || buildings[0].name.trim();
    let totalFlats = 0;
    let totalIssues = 0;
    const buildingIds = [];
    if (devName) {
      const { data: devBuildings } = await supabase.from("buildings").select("id,total_flats").eq("development_name", devName);
      if (devBuildings) {
        for (const b of devBuildings) {
          totalFlats += (b.total_flats || 0);
          buildingIds.push(b.id);
          const { count } = await supabase.from("issue_reports").select("*", { count: "exact", head: true }).eq("building_id", b.id);
          totalIssues += (count || 0);
        }
      }
    } else {
      for (const b of buildings) {
        totalFlats += (b.total_flats || 0);
        buildingIds.push(b.id);
        const { count } = await supabase.from("issue_reports").select("*", { count: "exact", head: true }).eq("building_id", b.id);
        totalIssues += (count || 0);
      }
    }
    return NextResponse.json({ found: true, existing: true, displayName, developmentName: devName, hasDevelopment: !!devName, totalFlats, totalIssues, buildingId: buildings[0].id, buildingName: buildings[0].name });
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
  return NextResponse.json({ found: false, existing: false, displayName: apiBuildingName, developmentName: null, hasDevelopment: false, totalFlats: apiTotalFlats, totalIssues: 0, buildingId: null, buildingName: apiBuildingName });
}
