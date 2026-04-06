import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Load portal data for a token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  // Look up token
  const { data: tokenData } = await supabase
    .from("agent_tokens")
    .select("id, managing_agent_id, development_id, expires_at")
    .eq("token", token)
    .single();

  if (!tokenData) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  if (new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json({ expired: true });
  }

  // Get agent name
  const { data: agent } = await supabase
    .from("managing_agents")
    .select("name")
    .eq("id", tokenData.managing_agent_id)
    .single();

  // Get development name
  const { data: dev } = await supabase
    .from("developments")
    .select("name")
    .eq("id", tokenData.development_id)
    .single();

  // Get OPEN issues for this development (exclude resolved)
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, category, description, status, created_at")
    .eq("development_id", tokenData.development_id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  // Get supporter counts and existing responses
  const enrichedIssues = [];
  for (const issue of issues || []) {
    const { count } = await supabase
      .from("issue_supporters")
      .select("id", { count: "exact", head: true })
      .eq("issue_id", issue.id);

    const { data: existingResp } = await supabase
      .from("agent_responses")
      .select("response_text")
      .eq("issue_id", issue.id)
      .eq("agent_token_id", tokenData.id)
      .order("created_at", { ascending: false })
      .limit(1);

    enrichedIssues.push({
      ...issue,
      supporters: count || 0,
      existingResponse: existingResp?.[0]?.response_text || null,
    });
  }

  return NextResponse.json({
    agentName: agent?.name || "Managing Agent",
    developmentName: dev?.name || "Development",
    issues: enrichedIssues,
  });
}

const VALID_STATUSES = ["acknowledged", "in_progress", "resolved", "escalated"] as const;
type ValidStatus = typeof VALID_STATUSES[number];

// POST: Submit a response to an issue
export async function POST(req: NextRequest) {
  const { token, issueId, response, newStatus } = await req.json();

  if (!token || !issueId || !response?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Validate status if provided
  let validStatus: ValidStatus | null = null;
  if (newStatus && newStatus.trim() !== "") {
    if (!VALID_STATUSES.includes(newStatus as ValidStatus)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    validStatus = newStatus as ValidStatus;
  }

  // Verify token
  const { data: tokenData } = await supabase
    .from("agent_tokens")
    .select("id, expires_at")
    .eq("token", token)
    .single();

  if (!tokenData) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  if (new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json({ error: "token expired" }, { status: 403 });
  }

  // Check if already responded to this issue
  const { data: existing } = await supabase
    .from("agent_responses")
    .select("id")
    .eq("issue_id", issueId)
    .eq("agent_token_id", tokenData.id)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from("agent_responses")
      .update({ response_text: response.trim(), new_status: validStatus })
      .eq("id", existing[0].id);
  } else {
    await supabase.from("agent_responses").insert({
      issue_id: issueId,
      agent_token_id: tokenData.id,
      response_text: response.trim(),
      new_status: validStatus,
    });
  }

  // Apply the status change to the issue itself
  if (validStatus) {
    const updates: Record<string, string | null> = {
      status: validStatus,
      updated_at: new Date().toISOString(),
    };
    if (validStatus === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
    await supabase.from("issues").update(updates).eq("id", issueId);
  }

  return NextResponse.json({ success: true });
}
