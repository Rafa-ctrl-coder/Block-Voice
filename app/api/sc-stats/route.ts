import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/sc-stats?slug=vista-chelsea-bridge
 *
 * Returns averaged service charge stats.
 * - If slug provided: stats for that development only
 * - If no slug: stats across all developments (area average)
 *
 * Response: { avgPerSqft, avgMonthly, lastYoYPct, trend, periods, hasData }
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  try {
    // Get all annuals with property sizes, optionally filtered by development
    let query = supabase
      .from("service_charge_annuals")
      .select("year, annual_total, is_half_yearly, has_both_halves, quarter_count, profile_id, building_id")
      .order("year", { ascending: true });

    // If slug provided, filter to that development's buildings
    if (slug) {
      const { data: devData } = await supabase
        .from("developments")
        .select("name")
        .eq("slug", slug)
        .single();

      if (!devData) {
        return NextResponse.json({ hasData: false });
      }

      // Get all building IDs for this development
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id")
        .eq("development_name", devData.name);

      if (!buildings || buildings.length === 0) {
        return NextResponse.json({ hasData: false });
      }

      query = query.in("building_id", buildings.map(b => b.id));
    }

    const { data: annuals } = await query;

    if (!annuals || annuals.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    // Get property sizes for per-sqft calculations
    const profileIds = [...new Set(annuals.map(a => a.profile_id))];
    const { data: sizes } = await supabase
      .from("property_sizes")
      .select("profile_id, building_id, sqft")
      .in("profile_id", profileIds);

    const sizeMap: Record<string, number> = {};
    if (sizes) {
      for (const s of sizes) {
        sizeMap[`${s.profile_id}|${s.building_id}`] = s.sqft;
      }
    }

    // Group annuals by year — annualise ALL records for per-sqft/monthly averages
    // but only use complete records for YoY growth calculations
    const yearData: Record<string, { totals: number[]; perSqfts: number[]; monthlies: number[]; completePerSqfts: number[] }> = {};

    for (const a of annuals) {
      const isPartialHY = a.is_half_yearly && !a.has_both_halves;
      const qCount = a.quarter_count || 0;
      const isPartialQ = qCount > 0 && qCount < 4;
      const isComplete = a.has_both_halves || qCount >= 4;
      const total = Number(a.annual_total);

      // Annualise partial records — check quarterly first (takes precedence)
      let annualised = total;
      if (isPartialQ) annualised = (total / qCount) * 4;
      else if (isPartialHY) annualised = total * 2;

      const monthly = annualised / 12;
      const sqft = sizeMap[`${a.profile_id}|${a.building_id}`] || 0;
      const perSqft = sqft > 0 ? annualised / sqft : 0;

      if (!yearData[a.year]) yearData[a.year] = { totals: [], perSqfts: [], monthlies: [], completePerSqfts: [] };
      yearData[a.year].totals.push(annualised);
      if (perSqft > 0) yearData[a.year].perSqfts.push(perSqft);
      yearData[a.year].monthlies.push(monthly);
      // Only complete records count for YoY
      if (isComplete && perSqft > 0) yearData[a.year].completePerSqfts.push(perSqft);
    }

    const years = Object.keys(yearData).sort();

    if (years.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    // Calculate averages for the latest year (using all data, annualised)
    const latestYear = years[years.length - 1];
    const latestData = yearData[latestYear];

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgPerSqft = avg(latestData.perSqfts);
    const avgMonthly = avg(latestData.monthlies);

    // Calculate YoY using only complete records (no partial annualisations)
    const yoyPcts: { year: string; pct: number }[] = [];
    for (let i = 1; i < years.length; i++) {
      const prevSqfts = yearData[years[i - 1]].completePerSqfts;
      const currSqfts = yearData[years[i]].completePerSqfts;
      if (prevSqfts.length > 0 && currSqfts.length > 0) {
        const prevAvg = avg(prevSqfts);
        const currAvg = avg(currSqfts);
        if (prevAvg > 0) {
          yoyPcts.push({ year: years[i], pct: ((currAvg - prevAvg) / prevAvg) * 100 });
        }
      }
    }

    const lastYoY = yoyPcts.length > 0 ? yoyPcts[yoyPcts.length - 1] : null;
    const prevYoY = yoyPcts.length > 1 ? yoyPcts[yoyPcts.length - 2] : null;

    // Determine trend
    let trend: "accelerating" | "decelerating" | "stable" | "unknown" = "unknown";
    if (lastYoY && prevYoY) {
      if (lastYoY.pct > prevYoY.pct + 0.5) trend = "accelerating";
      else if (lastYoY.pct < prevYoY.pct - 0.5) trend = "decelerating";
      else trend = "stable";
    }

    // Build yearly detail if requested
    const detail = req.nextUrl.searchParams.get("detail");
    const yearlyData = detail ? years.map(y => ({
      year: y,
      perSqft: Math.round(avg(yearData[y].perSqfts) * 100) / 100,
      monthly: Math.round(avg(yearData[y].monthlies)),
    })).filter(d => d.perSqft > 0) : undefined;

    return NextResponse.json({
      hasData: true,
      avgPerSqft: Math.round(avgPerSqft * 100) / 100,
      avgMonthly: Math.round(avgMonthly),
      lastYoYPct: lastYoY ? Math.round(lastYoY.pct * 100) / 100 : null,
      trend,
      periods: years.length,
      residents: profileIds.length,
      ...(yearlyData ? { yearlyData } : {}),
    });
  } catch (err) {
    console.error("SC stats error:", err);
    return NextResponse.json({ hasData: false });
  }
}
