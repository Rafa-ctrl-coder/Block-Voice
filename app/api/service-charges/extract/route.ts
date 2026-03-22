import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ExtractedLine {
  description: string;
  amount: number;
  invoice_date: string;
  invoice_number: string;
  period_type: string;
  year_end?: string;
}

interface ExtractionResult {
  lines: ExtractedLine[];
  property?: string;
  development?: string;
}

const EXTRACTION_PROMPT = `You are analysing a UK residential service charge demand document (screenshot from a property management portal).

IMPORTANT: These documents often show MULTIPLE charge cards/invoices on screen. Each card typically shows:
- Property name
- Invoice number
- Invoice date
- Description (e.g. "Half Yearly Apt Service Charge in advance")
- Charged amount

CRITICAL — Identify the billing period from the description text:
- "Half Yearly" or "HY" → period_type = "half_yearly"
- "Quarterly" or "QTR" or "Q1"/"Q2"/"Q3"/"Q4" → period_type = "quarterly"
- "Annual" or "Yearly" or "Full Year" or "FY" → period_type = "annual"
- "SCA ... Deficit" → period_type = "deficit"
- "SCA ... Surplus" or negative amounts with "Surplus" → period_type = "surplus"
- "Insurance" or "Ins Fund" (but NOT "Half Yearly Block Insurance") → period_type = "insurance"
- If description says "Half Yearly Block Insurance Charge" treat as period_type = "half_yearly" (it's a regular recurring charge)
- If description says "Quarterly Block Insurance Charge" treat as period_type = "quarterly"
- Anything else → period_type = "other"

IMPORTANT: Do NOT extract the same charge card twice. Each card on screen is unique — if you see similar descriptions with the same invoice number and amount, only extract it ONCE.

Extract ALL individual charge lines as a JSON object:
{
  "lines": [
    {
      "description": "Half Yearly Apt Service Charge in advance",
      "amount": 2619.59,
      "invoice_date": "2025-12-08",
      "invoice_number": "686890",
      "period_type": "half_yearly",
      "year_end": null,
      "charge_category": "service_charge"
    }
  ],
  "property": "Apartment 33, Sophora House",
  "development": null
}

charge_category must be one of:
- "service_charge" — for main service charges (apt, block, estate)
- "reserve_fund" — for reserve/sinking fund contributions
- "parking" — for parking-related charges
- "insurance" — for insurance
- "deficit" — for deficit balancing charges
- "surplus" — for surplus credits (amount should be negative)
- "other"

Rules:
- amount: GBP as a number. Negative for credits/surpluses.
- invoice_date: YYYY-MM-DD format
- year_end: only for deficit/surplus items, the year-end date it relates to (e.g. "2024-12-31")
- Extract EVERY visible charge card — there may be 10+ on screen
- If multiple invoices (different invoice numbers) are visible, extract all
- Return ONLY valid JSON. No markdown. No explanation.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured. Please add GEMINI_API_KEY to environment variables." },
      { status: 503 }
    );
  }

  try {
    const { documentUrl, profileId, buildingId } = await req.json();
    if (!documentUrl || !profileId || !buildingId) {
      return NextResponse.json({ error: "documentUrl, profileId, buildingId required" }, { status: 400 });
    }

    // Download document from Supabase Storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("service-charges")
      .download(documentUrl);

    if (dlError || !fileData) {
      return NextResponse.json({ error: "Failed to download document" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const ext = documentUrl.split(".").pop()?.toLowerCase() || "";
    const isPdf = ext === "pdf";
    const mimeType = isPdf ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
    const base64 = buffer.toString("base64");

    // Rate limit: max 10 extractions per user per day
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await supabase
      .from("api_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", "service_charge_extraction")
      .gte("created_at", `${today}T00:00:00Z`);
    if (todayCount && todayCount >= 10) {
      return NextResponse.json({ error: "Daily extraction limit reached (10/day). Try again tomorrow." }, { status: 429 });
    }

    // Send to Gemini API (Flash 2.0 — fast, cheap, great at document extraction)
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      { text: EXTRACTION_PROMPT },
    ]);

    const response = result.response;
    const responseText = response.text();
    const usage = response.usageMetadata;

    // Log API usage
    const inputTokens = usage?.promptTokenCount || 0;
    const outputTokens = usage?.candidatesTokenCount || 0;
    // Gemini 2.5 Pro pricing: ~$1.25/1M input, ~$10/1M output (under 200k)
    const costEstimate = (inputTokens * 0.00000125) + (outputTokens * 0.00001);
    await supabase.from("api_usage_log").insert({
      endpoint: "service_charge_extraction",
      model: "gemini-2.5-pro",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_estimate: costEstimate,
    }).then(() => {});

    // Parse response
    let extracted: ExtractionResult;
    try {
      // Strip markdown code fences if present
      let raw = responseText.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
      }
      extracted = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse extraction result", raw: responseText }, { status: 500 });
    }

    // Deduplicate lines within the same invoice
    // The model sometimes extracts the same card twice from scrolling screenshots
    // with slightly different description truncations. Dedup by invoice + rounded amount
    // since the same charge won't appear twice at the same amount on one invoice.
    const seen = new Set<string>();
    const dedupedLines = extracted.lines.filter((line) => {
      // Normalise description: lowercase, strip trailing dots/spaces, take first 30 chars
      const normDesc = (line.description || "").toLowerCase().replace(/\.\.\./g, "").replace(/\s+/g, " ").trim().slice(0, 30);
      const key = `${line.invoice_number}|${normDesc}|${line.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Save line items to database
    const lineInserts = dedupedLines.map((line) => ({
      profile_id: profileId,
      building_id: buildingId,
      invoice_number: line.invoice_number || null,
      invoice_date: line.invoice_date || null,
      description: line.description,
      amount: line.amount,
      period_type: line.period_type || "other",
      year_end: line.year_end || null,
      document_url: documentUrl,
    }));

    const { error: insertError } = await supabase.from("service_charge_lines").insert(lineInserts);
    if (insertError) {
      console.error("Failed to insert lines:", insertError);
      return NextResponse.json({ error: "Failed to save extracted data" }, { status: 500 });
    }

    // Calculate annuals from all lines for this user/building
    const { data: allLines } = await supabase
      .from("service_charge_lines")
      .select("*")
      .eq("profile_id", profileId)
      .eq("building_id", buildingId)
      .order("invoice_date", { ascending: true });

    if (allLines && allLines.length > 0) {
      // Deduplicate across all stored lines (normalised description + amount)
      const allSeen = new Set<string>();
      const uniqueLines = allLines.filter((l: Record<string, unknown>) => {
        const normDesc = ((l.description as string) || "").toLowerCase().replace(/\.\.\./g, "").replace(/\s+/g, " ").trim().slice(0, 30);
        const key = `${l.invoice_number}|${normDesc}|${l.amount}`;
        if (allSeen.has(key)) return false;
        allSeen.add(key);
        return true;
      });

      // Separate regular charges from deficit/surplus adjustments
      // Insurance is a regular recurring charge — include it in totals
      const regularLines = uniqueLines.filter(
        (l: Record<string, unknown>) => l.period_type !== "deficit" && l.period_type !== "surplus"
      );
      const adjustmentLines = uniqueLines.filter(
        (l: Record<string, unknown>) => l.period_type === "deficit" || l.period_type === "surplus"
      );

      // Detect billing frequency from the data
      const hasQuarterly = regularLines.some((l: Record<string, unknown>) => l.period_type === "quarterly");
      const hasHalfYearly = regularLines.some((l: Record<string, unknown>) => l.period_type === "half_yearly");
      const billingType = hasQuarterly ? "quarterly" : hasHalfYearly ? "half_yearly" : "annual";

      // Group by invoice number to get period totals
      const invoiceGroups: Record<string, { total: number; date: string }> = {};
      for (const line of regularLines) {
        const key = (line as Record<string, unknown>).invoice_number as string || (line as Record<string, unknown>).invoice_date as string || "unknown";
        if (!invoiceGroups[key]) {
          invoiceGroups[key] = {
            total: 0,
            date: (line as Record<string, unknown>).invoice_date as string || "",
          };
        }
        invoiceGroups[key].total += Number((line as Record<string, unknown>).amount);
      }

      // Sort invoices by date
      const invoices = Object.values(invoiceGroups).sort((a, b) => a.date.localeCompare(b.date));

      // Build service year periods
      // Service year = calendar year (Jan-Dec), matching year_end patterns
      const annuals: Record<string, { total: number; h1: number; h2: number; is_half_yearly: boolean; has_both_halves: boolean; quarter_count: number }> = {};

      for (const inv of invoices) {
        const d = new Date(inv.date);
        const month = d.getMonth(); // 0-indexed
        const year = d.getFullYear();
        const serviceYear = `${year}/${String(year + 1).slice(2)}`;

        if (!annuals[serviceYear]) annuals[serviceYear] = { total: 0, h1: 0, h2: 0, is_half_yearly: billingType !== "annual", has_both_halves: false, quarter_count: 0 };

        if (billingType === "quarterly") {
          annuals[serviceYear].total += inv.total;
          annuals[serviceYear].quarter_count += 1;
          // 4 quarters = full year
          if (annuals[serviceYear].quarter_count >= 4) annuals[serviceYear].has_both_halves = true;
        } else if (billingType === "half_yearly") {
          const half = month <= 6 ? "h1" : "h2";
          annuals[serviceYear][half] += inv.total;
          annuals[serviceYear].total += inv.total;
          if (annuals[serviceYear].h1 > 0 && annuals[serviceYear].h2 > 0) {
            annuals[serviceYear].has_both_halves = true;
          }
        } else {
          annuals[serviceYear].total += inv.total;
          annuals[serviceYear].has_both_halves = true; // annual = always complete
        }
      }

      // Calculate adjustments by year-end
      const adjustments: Record<string, number> = {};
      for (const adj of adjustmentLines) {
        const ye = (adj as Record<string, unknown>).year_end as string || "unknown";
        adjustments[ye] = (adjustments[ye] || 0) + Number((adj as Record<string, unknown>).amount);
      }

      // Upsert annual totals
      for (const [year, data] of Object.entries(annuals)) {
        await supabase.from("service_charge_annuals").upsert(
          {
            profile_id: profileId,
            building_id: buildingId,
            year,
            annual_total: data.total,
            h1_total: data.h1 || null,
            h2_total: data.h2 || null,
            is_half_yearly: data.is_half_yearly,
            has_both_halves: data.has_both_halves,
            quarter_count: data.quarter_count || 0,
            adjustment_total: adjustments[year.split("/")[0]] || 0,
          },
          { onConflict: "profile_id,building_id,year" }
        );
      }
    }

    return NextResponse.json({
      success: true,
      linesExtracted: extracted.lines.length,
      property: extracted.property,
    });
  } catch (err) {
    console.error("Extraction error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
