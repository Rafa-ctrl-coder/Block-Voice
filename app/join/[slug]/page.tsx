"use client";
import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

interface Dev {
  name: string;
  slug: string;
  postcodes: string[];
  total_units: number;
  developer: string;
}

export default function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [dev, setDev] = useState<Dev | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [freeholder, setFreeholder] = useState<string | null>(null);
  const [residentCount, setResidentCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scStats, setScStats] = useState<{ hasData: boolean; avgPerSqft?: number; avgMonthly?: number; lastYoYPct?: number | null; trend?: string } | null>(null);

  useEffect(() => {
    loadDev();
  }, [slug]);

  async function loadDev() {
    setLoading(true);

    const { data: devData } = await supabase
      .from("developments")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!devData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setDev(devData);

    // Get agent & freeholder names
    const { data: linkData } = await supabase
      .from("development_links")
      .select("managing_agent_id, freeholder_id")
      .eq("development_id", devData.id)
      .single();

    if (linkData) {
      const [{ data: agentData }, { data: fhData }] = await Promise.all([
        supabase.from("managing_agents").select("name").eq("id", linkData.managing_agent_id).single(),
        supabase.from("freeholders").select("name").eq("id", linkData.freeholder_id).single(),
      ]);
      if (agentData) setAgent(agentData.name);
      if (fhData) setFreeholder(fhData.name);
    }

    // Fetch counts via server API (bypasses RLS)
    try {
      const statsRes = await fetch(`/api/dev-stats?slug=${encodeURIComponent(slug)}`);
      const stats = await statsRes.json();
      setResidentCount(stats.residentCount || 0);
      setIssueCount(stats.issueCount || 0);
    } catch { /* counts stay at 0 */ }

    // Fetch SC stats for this development
    try {
      const scRes = await fetch(`/api/sc-stats?slug=${encodeURIComponent(slug)}`);
      const sc = await scRes.json();
      setScStats(sc);
    } catch { /* no SC data */ }

    setLoading(false);
  }

  const teal = "#1ec6a4";
  const postcode = dev?.postcodes?.[0] || "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--navy)" }}>
        <p className="text-[rgba(255,255,255,0.3)]">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--navy)" }}>
        <h1 className="text-2xl font-bold text-white mb-3">Development not found</h1>
        <p className="text-[rgba(255,255,255,0.5)] mb-6">This invite link doesn&apos;t match any development in our database.</p>
        <Link href="/" className="px-6 py-3 rounded-lg font-bold text-white" style={{ background: teal }}>
          Go to BlockVoice
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--navy)", color: "var(--t1)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-[6%] h-14" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/" className="font-extrabold text-[17px]" style={{ color: teal }}>BlockVoice</Link>
        <div className="flex items-center gap-5">
          <Link href="/login" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Sign In</Link>
          <Link href={`/signup?postcode=${encodeURIComponent(postcode)}`}
            className="font-bold text-[12px] px-4 py-[7px] rounded-lg text-white" style={{ background: teal }}>
            Join free
          </Link>
        </div>
      </nav>

      <div className="max-w-[640px] mx-auto px-4 py-8">

        {/* Development header */}
        <div className="text-center mb-7">
          <div className="text-[10px] uppercase tracking-[2px] font-bold mb-1" style={{ color: teal }}>Join your neighbours on BlockVoice</div>
          <h1 className="text-[30px] font-extrabold text-white mb-1.5">{dev?.name}</h1>
          <p className="text-sm" style={{ color: "var(--t3)" }}>{postcode} · {dev?.total_units} units</p>
          <div className="flex justify-center gap-4 mt-3.5">
            <div className="rounded-lg px-4 py-2" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <span className="text-lg font-extrabold" style={{ color: teal }}>{residentCount}</span>
              <span className="text-xs ml-1.5" style={{ color: "var(--t2)" }}>residents joined</span>
            </div>
            <div className="rounded-lg px-4 py-2" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <span className="text-lg font-extrabold text-white">{issueCount}</span>
              <span className="text-xs ml-1.5" style={{ color: "var(--t2)" }}>issues reported</span>
            </div>
          </div>
        </div>

        {/* What you'll see */}
        <div className="rounded-xl p-5 mb-4" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
          <h3 className="text-sm font-bold text-white mb-2.5">When you join, you&apos;ll see</h3>
          <div className="grid grid-cols-2 gap-1">
            {[
              agent ? `Managing agent: ${agent}` : "Managing agent details",
              freeholder ? `Freeholder: ${freeholder}` : "Freeholder details",
              "Service charge analysis",
              "All reported issues",
              "Your block details",
              "Invite & share tools",
            ].map(t => (
              <div key={t} className="flex items-center gap-1.5 py-1.5">
                <span className="text-xs" style={{ color: teal }}>✓</span>
                <span className="text-xs" style={{ color: "var(--t2)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Service charge snapshot teaser */}
        {scStats?.hasData && (
        <div className="rounded-[14px] p-5 mb-4" style={{ background: "var(--navy-card)", border: "1px solid rgba(30,198,164,0.15)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-white uppercase tracking-[1.5px]">Service charges in your building</span>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: "#fbbf24", color: "#412402" }}>BETA</span>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--t2)" }}>
            Residents at {dev?.name} are already tracking their service charges on BlockVoice. Here&apos;s what they&apos;re seeing.
          </p>

          {/* Stat cards — £/sqft + YoY only */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-[10px] p-3.5 text-center" style={{ background: "var(--navy)", border: "1px solid var(--navy-card-b)" }}>
              <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--t3)" }}>Current rate</div>
              <div className="text-2xl font-extrabold" style={{ color: teal }}>£{scStats.avgPerSqft?.toFixed(2)}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--t3)" }}>per sqft / year</div>
            </div>
            {scStats.lastYoYPct != null && (
            <div className="rounded-[10px] p-3.5 text-center" style={{ background: scStats.lastYoYPct > 5 ? "rgba(248,113,113,0.06)" : "var(--navy)", border: `1px solid ${scStats.lastYoYPct > 5 ? "rgba(248,113,113,0.15)" : "var(--navy-card-b)"}` }}>
              <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--t3)" }}>Last year&apos;s change</div>
              <div className={`text-2xl font-extrabold ${scStats.lastYoYPct > 5 ? "text-red-400" : "text-amber-400"}`}>+{scStats.lastYoYPct.toFixed(1)}%</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--t3)" }}>year on year</div>
            </div>
            )}
          </div>

          {/* Blurred YoY chart teaser */}
          <div className="relative overflow-hidden rounded-[10px] mb-4" style={{ background: "var(--navy)", border: "1px solid var(--navy-card-b)" }}>
            <div className="flex items-end justify-center gap-6 h-20 px-8 pt-5 pb-3.5" style={{ filter: "blur(5px)", opacity: 0.4 }}>
              {[{ h: 22, c: "#fbbf24", y: "2023/24" }, { h: 42, c: "#f87171", y: "2024/25" }, { h: 62, c: "#f87171", y: "2025/26" }].map(b => (
                <div key={b.y} className="text-center">
                  <div className="w-[70px] mx-auto rounded-t" style={{ height: b.h, background: b.c }} />
                  <div className="text-[9px] mt-1" style={{ color: "var(--t3)" }}>{b.y}</div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="text-[13px] font-bold text-white mb-0.5">
                {scStats.trend === "accelerating" ? "Year-by-year growth is accelerating" : "See how your charges are trending"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--t2)" }}>Sign up to see the full breakdown</div>
            </div>
          </div>

          <Link href={`/signup?postcode=${encodeURIComponent(postcode)}`}
            className="block w-full py-3.5 rounded-[10px] font-bold text-[15px] text-center text-white" style={{ background: teal }}>
            Join {dev?.name} on BlockVoice — free
          </Link>
          <p className="text-[11px] text-center mt-2 leading-relaxed" style={{ color: "var(--t3)" }}>
            Add your latest service charge invoice to help BlockVoice build more accurate data to share with fellow residents.
          </p>
        </div>
        )}

        {/* Quick signup hint */}
        <div className="rounded-xl p-5 mb-5 text-center" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
          <h3 className="text-[15px] font-bold text-white mb-1.5">Join in 30 seconds</h3>
          <p className="text-xs mb-3.5" style={{ color: "var(--t2)" }}>Tell us your apartment number and whether you&apos;re an owner or tenant. That&apos;s it.</p>
          <Link href={`/signup?postcode=${encodeURIComponent(postcode)}`}
            className="inline-block font-bold text-[14px] px-8 py-3 rounded-[10px] text-white" style={{ background: teal }}>
            Sign up now
          </Link>
        </div>

        <div className="text-center py-5 text-[11px]" style={{ color: "#334155" }}>BlockVoice — Everything about your building. In one place.</div>
      </div>

      {/* Footer */}
      <footer className="flex justify-between items-center flex-wrap gap-2.5 px-[6%] py-5"
        style={{ borderTop: "1px solid var(--border)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: teal }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "var(--t3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
