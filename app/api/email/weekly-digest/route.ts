import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Issue {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  supporters: number;
}

function memberEmailHtml(firstName: string, issues: Issue[], residentCount: number, slug: string) {
  const issueRows = issues.map(i => {
    const cat = i.category.charAt(0).toUpperCase() + i.category.slice(1);
    const desc = i.description.length > 120 ? i.description.slice(0, 120) + "..." : i.description;
    const supporters = i.supporters > 0 ? `${i.supporters} resident${i.supporters > 1 ? "s" : ""} supporting` : "Be the first to support";
    return `
      <tr><td style="padding:16px 20px;background:#111d33;border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:8px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="padding:0 0 6px 0;">
              <span style="font-size:15px;font-weight:700;color:#ffffff;">${i.title}</span>
              <span style="display:inline-block;margin-left:8px;font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:20px;background:rgba(30,198,164,0.12);color:#1ec6a4;border:1px solid rgba(30,198,164,0.25);letter-spacing:0.5px;">${cat}</span>
            </td>
          </tr>
          <tr><td style="padding:0 0 10px 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.6);">${desc}</td></tr>
          <tr><td style="padding:0;">
            <span style="font-size:12px;color:rgba(255,255,255,0.35);">${supporters}</span>
            <a href="https://blockvoice.co.uk/dashboard" style="display:inline-block;margin-left:12px;font-size:12px;font-weight:700;color:#1ec6a4;text-decoration:none;">Support this issue →</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding:0 0 28px 0;"><span style="font-size:20px;font-weight:800;color:#1ec6a4;">BlockVoice</span></td></tr>
  <tr><td style="padding:0 0 20px 0;">
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">Hi ${firstName},</p>
  </td></tr>
  <tr><td style="padding:0 0 24px 0;">
    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.85);">Here&rsquo;s what&rsquo;s happening at <strong style="color:#fff;">Vista, Chelsea Bridge</strong> this week.</p>
  </td></tr>
  <tr><td style="padding:0 0 8px 0;">
    <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1ec6a4;padding:0 0 12px 0;">
      ${issues.length} OPEN ISSUE${issues.length !== 1 ? "S" : ""} &middot; ${residentCount} RESIDENTS JOINED
    </div>
  </td></tr>
  ${issueRows}
  <tr><td style="height:24px;"></td></tr>
  <tr><td align="center">
    <a href="https://blockvoice.co.uk/dashboard" style="display:inline-block;background:#1ec6a4;color:#0a1628;font-size:15px;font-weight:800;padding:14px 40px;border-radius:10px;text-decoration:none;">Go to your dashboard</a>
  </td></tr>
  <tr><td style="height:12px;"></td></tr>
  <tr><td align="center"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">Have an issue to report? Log in and raise it — your neighbours will see it here next week.</p></td></tr>
  <tr><td style="height:32px;"></td></tr>
  <tr><td><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
  <tr><td style="padding:16px 0 0 0;">
    <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#1ec6a4;">BlockVoice</p>
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">Your building, fully understood.<br>Weekly update for Vista, Chelsea Bridge residents.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function nonMemberEmailHtml(firstName: string, issues: Issue[], residentCount: number) {
  const issueRows = issues.map(i => {
    const cat = i.category.charAt(0).toUpperCase() + i.category.slice(1);
    const desc = i.description.length > 120 ? i.description.slice(0, 120) + "..." : i.description;
    const supporters = i.supporters > 0 ? `${i.supporters} resident${i.supporters > 1 ? "s" : ""} supporting` : "No supporters yet";
    return `
      <tr><td style="padding:16px 20px;background:#111d33;border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr><td style="padding:0 0 6px 0;">
            <span style="font-size:15px;font-weight:700;color:#ffffff;">${i.title}</span>
            <span style="display:inline-block;margin-left:8px;font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:20px;background:rgba(30,198,164,0.12);color:#1ec6a4;border:1px solid rgba(30,198,164,0.25);letter-spacing:0.5px;">${cat}</span>
          </td></tr>
          <tr><td style="padding:0 0 8px 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.6);">${desc}</td></tr>
          <tr><td style="padding:0;font-size:12px;color:rgba(255,255,255,0.35);">${supporters}</td></tr>
        </table>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding:0 0 28px 0;"><span style="font-size:20px;font-weight:800;color:#1ec6a4;">BlockVoice</span></td></tr>
  <tr><td style="padding:0 0 20px 0;">
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">Hi ${firstName},</p>
  </td></tr>
  <tr><td style="padding:0 0 24px 0;">
    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.85);">
      <strong style="color:#fff;">${residentCount} residents</strong> at Vista, Chelsea Bridge have joined BlockVoice &mdash; and they&rsquo;ve raised <strong style="color:#fff;">${issues.length} issue${issues.length !== 1 ? "s" : ""}</strong> about the building.
    </p>
  </td></tr>
  <tr><td style="padding:0 0 28px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1ec6a4;">Issues raised by your neighbours</td></tr>
      ${issueRows}
    </table>
  </td></tr>
  <tr><td style="padding:0 0 28px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(30,198,164,0.1) 0%,rgba(30,198,164,0.02) 100%);border:1px solid rgba(30,198,164,0.25);border-radius:12px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.7);">
          Sign up to support these issues, add your own, and help make Vista better for everyone.
        </p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center">
    <a href="https://blockvoice.co.uk/join/vista-chelsea-bridge?utm_source=email&utm_campaign=weekly-digest" style="display:inline-block;background:#1ec6a4;color:#0a1628;font-size:15px;font-weight:800;padding:14px 40px;border-radius:10px;text-decoration:none;">Join Vista on BlockVoice</a>
  </td></tr>
  <tr><td style="height:10px;"></td></tr>
  <tr><td align="center"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">Free forever &middot; 30 seconds &middot; No paperwork</p></td></tr>
  <tr><td style="height:32px;"></td></tr>
  <tr><td><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
  <tr><td style="padding:16px 0 0 0;">
    <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#1ec6a4;">BlockVoice</p>
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">Your building, fully understood.<br>You received this because a resident at Vista, Chelsea Bridge invited you.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const { secret, slug, nonMemberEmails } = await req.json();

  // Simple auth — use a secret key to prevent unauthorized sends
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const devSlug = slug || "vista-chelsea-bridge";

  // Get development
  const { data: dev } = await supabase
    .from("developments")
    .select("id, name")
    .eq("slug", devSlug)
    .single();

  if (!dev) return NextResponse.json({ error: "development not found" }, { status: 404 });

  // Get issues
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, category, description, status, created_at")
    .eq("development_id", dev.id)
    .order("created_at", { ascending: false });

  // Get supporter counts
  const issuesWithCounts: Issue[] = [];
  for (const issue of issues || []) {
    const { count } = await supabase
      .from("issue_supporters")
      .select("id", { count: "exact", head: true })
      .eq("issue_id", issue.id);
    issuesWithCounts.push({ ...issue, supporters: count || 0 });
  }

  // Get all buildings for this development
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id")
    .eq("development_name", dev.name);

  const buildingIds = (buildings || []).map(b => b.id);

  // Get member profiles
  const { data: members } = await supabase
    .from("profiles")
    .select("first_name, email, building_id")
    .in("building_id", buildingIds);

  const residentCount = members?.length || 0;
  const issueCount = issuesWithCounts.length;

  const results = { membersSent: 0, nonMembersSent: 0, failed: 0, errors: [] as string[] };

  // Send to members
  for (const m of members || []) {
    try {
      await resend.emails.send({
        from: "BlockVoice <hello@blockvoice.co.uk>",
        to: [m.email],
        subject: `${issueCount} issue${issueCount !== 1 ? "s" : ""} raised at Vista this week`,
        html: memberEmailHtml(m.first_name || "there", issuesWithCounts, residentCount, devSlug),
      });
      results.membersSent++;
    } catch (e: unknown) {
      results.failed++;
      results.errors.push(`${m.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Send to non-members (passed as array of {first, email})
  if (nonMemberEmails && Array.isArray(nonMemberEmails)) {
    const memberEmailSet = new Set((members || []).map(m => m.email.toLowerCase()));
    for (const nm of nonMemberEmails) {
      if (memberEmailSet.has(nm.email.toLowerCase())) continue; // skip if already a member
      try {
        await resend.emails.send({
          from: "BlockVoice <hello@blockvoice.co.uk>",
          to: [nm.email],
          subject: `${issues.length} issue${issues.length !== 1 ? "s" : ""} raised at Vista — your neighbours need your support`,
          html: nonMemberEmailHtml(nm.first || "there", issues, residentCount),
        });
        results.nonMembersSent++;
      } catch (e: unknown) {
        results.failed++;
        results.errors.push(`${nm.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return NextResponse.json(results);
}

// GET handler for Vercel Cron (Saturday 10am UK)
export async function GET(req: NextRequest) {
  const isCron = req.nextUrl.searchParams.get("cron") === "true";
  const authHeader = req.headers.get("authorization");

  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  // Also allow if ?cron=true and CRON_SECRET matches or no CRON_SECRET set
  if (!isCron) {
    return NextResponse.json({ error: "method not allowed" }, { status: 405 });
  }

  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Dedup guard — check if we already sent a digest today (use api_usage_log which has created_at)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: recentLog } = await supabase
    .from("api_usage_log")
    .select("id")
    .eq("endpoint", "weekly_digest_cron")
    .gte("created_at", today + "T00:00:00Z")
    .limit(1);

  if (recentLog && recentLog.length > 0) {
    return NextResponse.json({ skipped: true, reason: "already sent today" });
  }

  // Log this send FIRST to prevent duplicates from concurrent retries
  await supabase.from("api_usage_log").insert({ endpoint: "weekly_digest_cron", model: "cron", input_tokens: 0, output_tokens: 0, cost_estimate: 0 });

  // Hardcoded non-member list from Vista Residents Register
  const nonMemberEmails = [
    {first:"Maha",email:"maha@mosaic-enterprises.com"},{first:"Mohamed",email:"mohamed.abbas@hotmail.co.uk"},
    {first:"Seif",email:"seifeldefrawi@gmail.com"},{first:"Ali",email:"aliizic@gmail.com"},
    {first:"Sherief",email:"defrawisherief@gmail.com"},{first:"Ezz",email:"ezzeldef@hotmail.co.uk"},
    {first:"Dascha",email:"nefedov.dascha@gmail.com"},{first:"Gabriel",email:"gabriel.jourdan@gmx.de"},
    {first:"Busra",email:"uygarmesudiyeli@hotmail.com"},{first:"Bertug",email:"osenbertug@gmail.com"},
    {first:"Erkan",email:"erkan@dogruer.com"},{first:"John",email:"cuneytozgumus@gmail.com"},
    {first:"Levent",email:"levent@akgerman.com"},{first:"Isil",email:"isilsusokmenn03@gmail.com"},
    {first:"Deborah",email:"debandmartin@hotmail.com"},{first:"Galina",email:"galina.dean@gmail.com"},
    {first:"Jude",email:"nkutoubi@gmail.com"},{first:"Abdullah",email:"52cascadecourt@gmail.com"},
    {first:"Mehmet",email:"mehmetpilavci@hotmail.com"},{first:"Ahmed",email:"ahmedbhameed@outlook.com"},
    {first:"Saad",email:"saad.alkaabi@gmail.com"},{first:"Kumsal",email:"kumsalsahin@hotmail.com"},
    {first:"Fiona",email:"roqafi@gmail.com"},{first:"Alex",email:"alexyeosn@gmail.com"},
    {first:"Bill",email:"wedgewood638@gmail.com"},{first:"Jason",email:"jasonparisgeorge@aol.com"},
    {first:"Sultan",email:"sultan.sokmen@yahoo.com"},{first:"Dean",email:"dean.possenniskie@aenetworks.co.uk"},
    {first:"Richard",email:"rbagley82@gmail.com"},{first:"Nadia",email:"nadia.alsaeed@gmail.com"},
    {first:"Gigi",email:"ghislaine.hock@gmail.com"},{first:"Valerie",email:"teh.valerie@gmail.com"},
    {first:"Masarra",email:"arch.masara@gmail.com"},{first:"Barbara",email:"clark.ba1984@gmail.com"},
    {first:"Abdulrahman",email:"ar.alrugaib@gmail.com"},{first:"Agne",email:"shopping@gautama.ca"},
    {first:"Hyun",email:"greentyvv@gmail.com"},{first:"Alex",email:"alexanderhodgkins@hotmail.com"},
  ];

  // Simulate a POST request internally
  const devSlug = "vista-chelsea-bridge";

  const { data: dev } = await supabase
    .from("developments")
    .select("id, name")
    .eq("slug", devSlug)
    .single();

  if (!dev) return NextResponse.json({ error: "development not found" }, { status: 404 });

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, category, description, status, created_at")
    .eq("development_id", dev.id)
    .order("created_at", { ascending: false });

  if (!issues || issues.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no issues to report" });
  }

  const issuesWithCounts: Issue[] = [];
  for (const issue of issues) {
    const { count } = await supabase
      .from("issue_supporters")
      .select("id", { count: "exact", head: true })
      .eq("issue_id", issue.id);
    issuesWithCounts.push({ ...issue, supporters: count || 0 });
  }

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id")
    .eq("development_name", dev.name);

  const buildingIds = (buildings || []).map(b => b.id);

  const { data: members } = await supabase
    .from("profiles")
    .select("first_name, email, building_id")
    .in("building_id", buildingIds);

  const residentCount = members?.length || 0;
  const issueCount = issuesWithCounts.length;
  const results = { membersSent: 0, nonMembersSent: 0, failed: 0, errors: [] as string[] };

  // Send to members
  for (const m of members || []) {
    try {
      await resend.emails.send({
        from: "BlockVoice <hello@blockvoice.co.uk>",
        to: [m.email],
        subject: `${issueCount} issue${issueCount !== 1 ? "s" : ""} raised at Vista this week`,
        html: memberEmailHtml(m.first_name || "there", issuesWithCounts, residentCount, devSlug),
      });
      results.membersSent++;
    } catch (e: unknown) {
      results.failed++;
      results.errors.push(`${m.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Send to non-members
  const memberEmailSet = new Set((members || []).map(m => m.email.toLowerCase()));
  for (const nm of nonMemberEmails) {
    if (memberEmailSet.has(nm.email.toLowerCase())) continue;
    try {
      await resend.emails.send({
        from: "BlockVoice <hello@blockvoice.co.uk>",
        to: [nm.email],
        subject: `${issues.length} issue${issues.length !== 1 ? "s" : ""} raised at Vista — your neighbours need your support`,
        html: nonMemberEmailHtml(nm.first || "there", issuesWithCounts, residentCount),
      });
      results.nonMembersSent++;
    } catch (e: unknown) {
      results.failed++;
      results.errors.push(`${nm.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json(results);
}
