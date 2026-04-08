import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DOC_TYPES,
  DocType,
  filterCommunitySummary,
  getPrompt,
  isValidDocType,
} from "@/app/lib/doc-prompts";

// Service-role client at module level — matches the pattern in
// app/api/service-charges/extract/route.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DAILY_CAP = 10;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured." },
      { status: 503 }
    );
  }

  try {
    // ---- 1. Parse multipart form ----
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const docType = form.get("doc_type") as string | null;
    const profileId = form.get("profile_id") as string | null;
    const buildingId = form.get("building_id") as string | null;

    if (!file || !docType || !profileId || !buildingId) {
      return NextResponse.json(
        { error: "file, doc_type, profile_id, building_id required" },
        { status: 400 }
      );
    }

    // ---- 2. Validate ----
    if (!isValidDocType(docType)) {
      return NextResponse.json(
        { error: `Invalid doc_type. Must be one of: ${DOC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_BYTES / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: PDF, PNG, JPG.` },
        { status: 415 }
      );
    }

    // ---- 3. Verify the building belongs to the caller, fetch development_name ----
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, building_id")
      .eq("id", profileId)
      .single();

    if (!profile || profile.building_id !== buildingId) {
      return NextResponse.json(
        { error: "Building does not match profile" },
        { status: 403 }
      );
    }

    const { data: building } = await supabase
      .from("buildings")
      .select("id, development_name")
      .eq("id", buildingId)
      .single();

    if (!building || !building.development_name) {
      return NextResponse.json(
        { error: "Building has no development link" },
        { status: 400 }
      );
    }
    const developmentName: string = building.development_name;

    // ---- 4. Per-user rate limit (10 uploads/day) ----
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await supabase
      .from("api_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", "community_doc_analysis")
      .eq("profile_id", profileId)
      .gte("created_at", `${today}T00:00:00Z`);

    if (todayCount && todayCount >= DAILY_CAP) {
      return NextResponse.json(
        { error: `Daily upload limit reached (${DAILY_CAP}/day). Try again tomorrow.` },
        { status: 429 }
      );
    }

    // ---- 5. Insert row with status='analysing' ----
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const { data: inserted, error: insertError } = await supabase
      .from("community_documents")
      .insert({
        profile_id: profileId,
        building_id: buildingId,
        development_name: developmentName,
        doc_type: docType,
        original_filename: file.name,
        storage_path: "pending", // updated after successful storage upload
        file_size_bytes: file.size,
        mime_type: file.type,
        status: "analysing",
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error("Failed to insert community_documents row:", insertError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    const documentId = inserted.id as string;
    const storagePath = `${profileId}/${documentId}.${ext}`;

    // ---- 6. Upload file to community-documents bucket ----
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("community-documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      // Clean up the row
      await supabase.from("community_documents").delete().eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Update row with real storage_path
    await supabase
      .from("community_documents")
      .update({ storage_path: storagePath })
      .eq("id", documentId);

    // ---- 7. Call Gemini 2.5 Pro ----
    const base64 = buffer.toString("base64");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    let responseText = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: file.type,
            data: base64,
          },
        },
        { text: getPrompt(docType as DocType) },
      ]);
      const response = result.response;
      responseText = response.text();
      const usage = response.usageMetadata;
      inputTokens = usage?.promptTokenCount || 0;
      outputTokens = usage?.candidatesTokenCount || 0;
    } catch (geminiErr) {
      console.error("Gemini call failed:", geminiErr);
      await supabase
        .from("community_documents")
        .update({
          status: "failed",
          analysis_error: geminiErr instanceof Error ? geminiErr.message : "Gemini request failed",
        })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Analysis failed. Please try again later." },
        { status: 502 }
      );
    }

    // Gemini 2.5 Pro pricing: ~$1.25/1M input, ~$10/1M output (under 200k)
    const costEstimate = inputTokens * 0.00000125 + outputTokens * 0.00001;
    await supabase
      .from("api_usage_log")
      .insert({
        endpoint: "community_doc_analysis",
        model: "gemini-2.5-pro",
        profile_id: profileId,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_estimate: costEstimate,
      })
      .then(() => {});

    // ---- 8. Parse response ----
    let parsed: { personal_analysis?: unknown; community_summary?: unknown } = {};
    try {
      let raw = responseText.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", parseErr);
      await supabase
        .from("community_documents")
        .update({
          status: "failed",
          analysis_error: "Could not parse analysis result",
        })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to parse analysis result" },
        { status: 500 }
      );
    }

    const personalAnalysis = (parsed.personal_analysis ?? null) as Record<string, unknown> | null;
    const rawSummary = (parsed.community_summary ?? null) as Record<string, unknown> | null;
    const communitySummary = filterCommunitySummary(docType as DocType, rawSummary);

    // Extract document_date from personal_analysis if present
    let documentDate: string | null = null;
    if (personalAnalysis) {
      const candidates = [
        personalAnalysis.invoice_date,
        personalAnalysis.report_date,
        personalAnalysis.date,
        personalAnalysis.year_end,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}/.test(c)) {
          documentDate = c.slice(0, 10);
          break;
        }
      }
    }

    // ---- 9. Update row to 'ready' ----
    const { data: finalRow, error: updateError } = await supabase
      .from("community_documents")
      .update({
        status: "ready",
        personal_analysis: personalAnalysis,
        community_summary: communitySummary,
        document_date: documentDate,
        analysis_error: null,
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update community_documents row:", updateError);
      return NextResponse.json(
        { error: "Analysis complete but failed to save results" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, document: finalRow });
  } catch (err) {
    console.error("Community document upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
