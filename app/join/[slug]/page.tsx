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

      {/* Hero */}
      <section className="relative overflow-hidden px-[6%] pt-16 pb-14 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[240px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(30,198,164,0.06) 0%, transparent 70%)" }} />

        <p className="inline-block text-[11px] font-semibold uppercase tracking-[1.2px] mb-4" style={{ color: teal }}>
          You&apos;ve been invited
        </p>

        <h1 className="font-extrabold text-white leading-[1.08] mb-4 tracking-[-1.5px]"
          style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
          Join {dev?.name}
          <br /><span style={{ color: teal }}>on BlockVoice</span>
        </h1>

        <p className="mx-auto mb-10 max-w-[480px] leading-relaxed" style={{ color: "var(--t2)", fontSize: "15px" }}>
          A fellow resident has invited you to BlockVoice — the free platform that gives you full transparency on who manages your building and how well they&apos;re doing it.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-6 mb-10">
          {[
            { value: residentCount, label: "Residents joined" },
            { value: issueCount, label: "Issues reported" },
            { value: dev?.total_units || 0, label: "Units in development" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-[11px]" style={{ color: "var(--t3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Development info cards */}
        <div className="max-w-[520px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 text-left">
          {agent && (
            <div className="rounded-xl p-4" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <p className="text-[10px] uppercase font-bold tracking-wide mb-1" style={{ color: "var(--t3)" }}>Managing Agent</p>
              <p className="font-semibold text-white text-sm">{agent}</p>
            </div>
          )}
          {freeholder && (
            <div className="rounded-xl p-4" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <p className="text-[10px] uppercase font-bold tracking-wide mb-1" style={{ color: "var(--t3)" }}>Freeholder</p>
              <p className="font-semibold text-white text-sm">{freeholder}</p>
            </div>
          )}
        </div>

        {/* What you'll see */}
        <div className="max-w-[520px] mx-auto mb-10">
          <p className="text-[11px] uppercase font-semibold tracking-wide mb-3" style={{ color: "var(--t3)" }}>
            What you&apos;ll see when you join
          </p>
          <div className="flex flex-wrap gap-[6px] justify-center">
            {["Managing agent details", "Freeholder info", "Contact information", "Building performance score", "Issue tracker", "Your documents"].map(tag => (
              <span key={tag} className="text-[10px] font-semibold px-[10px] py-[3px] rounded-full whitespace-nowrap"
                style={{ background: "var(--teal-dim)", border: "1px solid var(--teal-border)", color: teal }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link href={`/signup?postcode=${encodeURIComponent(postcode)}`}
          className="inline-block font-bold text-[15px] px-10 py-[14px] rounded-[10px] text-white" style={{ background: teal }}>
          Join {dev?.name} — It&apos;s Free
        </Link>
        <p className="mt-2.5 text-[11px]" style={{ color: "var(--t3)" }}>No card required. Takes under 30 seconds.</p>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-center flex-wrap gap-2.5 px-[6%] py-5"
        style={{ borderTop: "1px solid var(--border)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: teal }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "var(--t3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
