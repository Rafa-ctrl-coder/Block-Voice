import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Keyword → slug lookup table from the spec
const KEYWORD_MAP: [string[], string][] = [
  [["Vista", "Sophora", "Acacia", "Cascade Court"], "vista-chelsea-bridge"],
  [["Circus West", "Battersea Power Station Phase 1"], "bps-phase-1"],
  [["Embassy Gardens", "Sky Pool"], "embassy-gardens"],
  [["Riverlight", "Quay House"], "riverlight"],
  [["Prince of Wales Drive", "Kensington House", "Huntington House"], "prince-of-wales-drive"],
  [["Chelsea Bridge Wharf"], "chelsea-bridge-wharf"],
  [["Battersea Reach", "Commodore House"], "battersea-reach"],
  [["St George Wharf", "The Tower, St George"], "st-george-wharf"],
  [["One Thames City", "Thames City"], "one-thames-city"],
  [["DAMAC Tower"], "damac-tower"],
  [["Sky Gardens", "Vauxhall Sky Gardens"], "sky-gardens"],
  [["Bloom Nine Elms", "Bloom East", "Bloom West"], "bloom-nine-elms"],
  [["Nine Elms Point"], "nine-elms-point"],
  [["One Linear Place", "London Square Nine Elms"], "one-linear-place"],
  [["Battersea Exchange", "Patcham Terrace"], "battersea-exchange"],
  [["Grosvenor Waterside", "Cubitt Building", "Bramah House", "Caro Point", "Hepworth Court"], "grosvenor-waterside"],
  [["Moda", "Embassy Boulevard"], "moda-embassy-boulevard"],
  [["The Dumont"], "the-dumont"],
  [["Keybridge"], "keybridge"],
];

function matchKeywords(address: string): string | null {
  const upper = address.toUpperCase();
  for (const [keywords, slug] of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (upper.includes(kw.toUpperCase())) return slug;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode");
  const address = req.nextUrl.searchParams.get("address"); // selected address text

  if (!postcode) {
    return NextResponse.json({ error: "No postcode" }, { status: 400 });
  }

  const cleaned = postcode
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(.+?)(\d[A-Z]{2})$/, "$1 $2");

  // If an address was selected, try keyword match first
  if (address) {
    const keywordSlug = matchKeywords(address);
    if (keywordSlug) {
      const { data: dev } = await supabase
        .from("developments")
        .select("id, name, slug, total_units")
        .eq("slug", keywordSlug)
        .single();

      if (dev) {
        return NextResponse.json({
          matched: true,
          slug: dev.slug,
          name: dev.name,
          totalUnits: dev.total_units,
        });
      }
    }
  }

  // Postcode match — check if this postcode belongs to any development
  const { data: developments } = await supabase
    .from("developments")
    .select("id, name, slug, postcodes, total_units");

  if (developments) {
    const matches = developments.filter((d) =>
      d.postcodes?.some(
        (pc: string) => pc.replace(/\s+/g, "") === cleaned.replace(/\s+/g, "")
      )
    );

    if (matches.length === 1) {
      return NextResponse.json({
        matched: true,
        slug: matches[0].slug,
        name: matches[0].name,
        totalUnits: matches[0].total_units,
      });
    }

    if (matches.length > 1) {
      // Multiple developments share this postcode — disambiguation
      return NextResponse.json({
        matched: false,
        candidates: matches.map((d) => ({
          slug: d.slug,
          name: d.name,
          totalUnits: d.total_units,
        })),
      });
    }
  }

  // No match
  return NextResponse.json({ matched: false, candidates: [] });
}
