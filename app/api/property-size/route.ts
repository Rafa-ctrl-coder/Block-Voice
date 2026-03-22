import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode");
  const building = req.nextUrl.searchParams.get("building");
  const flat = req.nextUrl.searchParams.get("flat");

  if (!postcode) {
    return NextResponse.json({ error: "postcode required" }, { status: 400 });
  }

  const epcEmail = process.env.EPC_API_EMAIL;
  const epcKey = process.env.EPC_API_KEY;

  if (!epcEmail || !epcKey) {
    return NextResponse.json({ found: false, reason: "EPC API not configured" });
  }

  try {
    // Build query params
    const params = new URLSearchParams({ postcode });
    if (building) params.set("address", building);

    const auth = Buffer.from(`${epcEmail}:${epcKey}`).toString("base64");
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?${params}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ found: false, reason: "EPC API error" });
    }

    const data = await res.json();
    const rows = data?.rows || [];

    if (rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    // Try to match specific flat
    let match = null;
    if (flat) {
      const flatNorm = flat.toString().toLowerCase().replace(/\s+/g, "");
      match = rows.find((r: Record<string, string>) => {
        const addr = (r.address || "").toLowerCase().replace(/\s+/g, "");
        return addr.includes(`flat${flatNorm}`) || addr.includes(`apartment${flatNorm}`);
      });
    }

    // Fall back to first result
    if (!match) match = rows[0];

    const sqm = parseFloat(match["total-floor-area"]);
    if (isNaN(sqm)) {
      return NextResponse.json({ found: false });
    }

    const sqft = Math.round(sqm * 10.764);
    return NextResponse.json({ found: true, sqft, sqm: Math.round(sqm), source: "epc" });
  } catch (err) {
    console.error("EPC lookup error:", err);
    return NextResponse.json({ found: false, reason: "lookup failed" });
  }
}
