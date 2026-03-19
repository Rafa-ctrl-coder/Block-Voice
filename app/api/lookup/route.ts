import { NextRequest, NextResponse } from "next/server";
const API_KEY = process.env.IDEAL_POSTCODES_KEY;
export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "No postcode" }, { status: 400 });
  try {
    const res = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${API_KEY}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
