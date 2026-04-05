"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SYNTHETIC_INDEX, SYNTHETIC_WEIGHTED, SYNTHETIC_YEARS, LONDON_ACTUALS_WEIGHTED, ACTUALS_YEARS, getIndexChartData } from "./service-charges/data";

interface Candidate { slug: string; name: string; totalUnits: number }
interface Address { line_1: string; line_2: string; building_name: string; sub_building_name: string; thoroughfare: string; post_town: string }
interface ScStats { hasData: boolean; avgPerSqft?: number; avgMonthly?: number; lastYoYPct?: number | null; trend?: string }
interface YearData { year: string; perSqft: number; monthly: number }

function PerSqftChart() {
  const [data, setData] = useState<YearData[]>([]);
  useEffect(() => {
    fetch("/api/sc-stats?detail=true").then(r => r.json()).then(d => {
      if (d.yearlyData) setData(d.yearlyData);
    }).catch(() => {});
  }, []);

  if (data.length < 2) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>Price per sqft — annualised</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}`} />
            <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 11 }} formatter={(v) => [`£${Number(v).toFixed(2)}`, "per sqft"]} />
            <Line type="monotone" dataKey="perSqft" stroke="#1ec6a4" strokeWidth={2.5} dot={{ r: 3, fill: "#1ec6a4" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>Average monthly charge</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}`} />
            <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 11 }} formatter={(v) => [`£${Number(v).toFixed(0)}`, "monthly"]} />
            <Bar dataKey="monthly" fill="#1ec6a4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddresses, setShowAddresses] = useState(false);
  const [matching, setMatching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [scStats, setScStats] = useState<ScStats | null>(null);

  useEffect(() => {
    fetch("/api/sc-stats").then(r => r.json()).then(setScStats).catch(() => {});
  }, []);

  function reset() { setAddresses([]); setShowAddresses(false); setCandidates([]); setNoMatch(false); setError(""); }

  async function handleSearch() {
    if (!postcode.trim()) return;
    setSearching(true); reset();
    try {
      const r = await fetch("/api/lookup?postcode=" + encodeURIComponent(postcode.trim()));
      const d = await r.json();
      if (d.result?.length > 0) { setAddresses(d.result); setShowAddresses(true); }
      else { await matchPostcode(); }
    } catch { setError("Could not look up this postcode."); }
    finally { setSearching(false); }
  }

  async function matchPostcode() {
    const r = await fetch("/api/check-building?postcode=" + encodeURIComponent(postcode.trim()));
    const d = await r.json();
    if (d.matched && d.slug) router.push("/buildings/" + d.slug);
    else if (d.candidates?.length > 0) setCandidates(d.candidates);
    else setNoMatch(true);
  }

  async function selectAddress(idx: number) {
    const a = addresses[idx];
    const full = [a.sub_building_name, a.building_name, a.thoroughfare, a.post_town].filter(Boolean).join(", ");
    setShowAddresses(false); setMatching(true);
    try {
      const r = await fetch("/api/check-building?postcode=" + encodeURIComponent(postcode.trim()) + "&address=" + encodeURIComponent(full));
      const d = await r.json();
      if (d.matched && d.slug) router.push("/buildings/" + d.slug);
      else if (d.candidates?.length > 0) setCandidates(d.candidates);
      else setNoMatch(true);
    } catch { setError("Something went wrong."); }
    finally { setMatching(false); }
  }

  const teal = "var(--teal)";

  return (
    <div className="min-h-screen" style={{ background: "var(--navy)", color: "var(--t1)" }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-[6%] h-[56px]"
        style={{ background: "var(--navy)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/" className="font-extrabold text-[17px]" style={{ color: teal }}>BlockVoice</Link>
        <div className="flex items-center gap-5">
          <Link href="/service-charges" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Service Charge Index</Link>
          <Link href="/agents" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Managing Agents</Link>
          <Link href="/login" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Sign In</Link>
          <Link href="/signup" className="font-bold text-[12px] px-4 py-[7px] rounded-lg text-white"
            style={{ background: teal }}>Join free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-[6%] pt-20 pb-[72px] text-center" style={{ background: "var(--navy)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[240px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(30,198,164,0.06) 0%, transparent 70%)" }} />

        <p className="inline-block text-[11px] font-semibold uppercase tracking-[1.2px] mb-5" style={{ color: teal }}>
          Your building, fully understood
        </p>

        <h1 className="font-extrabold text-white leading-[1.08] mb-5 tracking-[-1.5px]"
          style={{ fontSize: "clamp(32px, 4.5vw, 56px)" }}>
          Everything about<br />your building.<br />
          <span style={{ color: teal }}>In one place.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-[500px] leading-relaxed"
          style={{ color: "var(--t2)", fontSize: "clamp(14px, 1.5vw, 17px)" }}>
          BlockVoice gives you transparency on who manages your building, what you&apos;re paying for, how well it&apos;s being run — and the tools to act when something isn&apos;t right.
        </p>

        {/* Search */}
        <div className="flex max-w-[460px] mx-auto rounded-[10px] overflow-hidden mb-3"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <input type="text" value={postcode}
            onChange={e => { setPostcode(e.target.value); reset(); }}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Enter your postcode e.g. SW8 4NR"
            className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-white text-[14px] tracking-wide placeholder:opacity-25" />
          <button onClick={handleSearch} disabled={searching}
            className="font-bold text-[12px] px-5 border-none cursor-pointer whitespace-nowrap text-white disabled:opacity-50"
            style={{ background: teal }}>
            {searching ? "Searching..." : "Find my building"}
          </button>
        </div>
        <p className="text-[11px]" style={{ color: "var(--t3)" }}>Free to join. No paperwork.</p>

        {error && <p className="text-red-400 text-[13px] mt-3">{error}</p>}

        {showAddresses && addresses.length > 0 && (
          <div className="mt-5 max-w-[460px] mx-auto text-left">
            <label className="block text-[13px] mb-1" style={{ color: "var(--t2)" }}>Select your address</label>
            <select onChange={e => { if (e.target.value !== "") selectAddress(parseInt(e.target.value)); }}
              className="w-full rounded-lg px-4 py-3 text-white text-[13px]"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} defaultValue="">
              <option value="">Pick your address...</option>
              {addresses.map((a, i) => <option key={i} value={i}>{[a.sub_building_name, a.building_name, a.thoroughfare].filter(Boolean).join(", ")}</option>)}
            </select>
          </div>
        )}

        {matching && <p className="text-[13px] mt-4" style={{ color: "var(--t2)" }}>Finding your building...</p>}

        {candidates.length > 0 && (
          <div className="mt-6 max-w-[460px] mx-auto space-y-3 text-left">
            <p className="text-[13px] mb-2" style={{ color: "var(--t2)" }}>We found these buildings near you — which is yours?</p>
            {candidates.map(c => (
              <button key={c.slug} onClick={() => router.push("/buildings/" + c.slug)}
                className="w-full rounded-xl p-4 text-left transition-colors"
                style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
                <h3 className="font-bold text-white text-[14px]">{c.name}</h3>
                <span className="text-[11px]" style={{ color: "var(--t3)" }}>{c.totalUnits} units</span>
              </button>
            ))}
            <button onClick={() => { setCandidates([]); setNoMatch(true); }} className="w-full text-[12px] py-2" style={{ color: "var(--t3)" }}>
              None of these — my building isn&apos;t listed
            </button>
          </div>
        )}

        {noMatch && (
          <div className="mt-6 max-w-[460px] mx-auto space-y-3 text-left">
            <div className="rounded-xl p-5" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <h3 className="font-bold text-white text-lg mb-2">We don&apos;t have your building yet</h3>
              <p className="text-[13px]" style={{ color: "var(--t2)" }}>Help us grow the database — add your building and be the first resident to join.</p>
            </div>
            <Link href={"/signup?postcode=" + encodeURIComponent(postcode)}
              className="block w-full py-3 rounded-lg font-bold text-[15px] text-center text-white" style={{ background: teal }}>
              Add your building
            </Link>
          </div>
        )}
      </section>

      {/* SERVICE CHARGE INDEX TEASER */}
      <div className="px-[6%] py-10">
        <div className="max-w-[760px] mx-auto">
          <p className="text-[11px] uppercase font-semibold tracking-[1.2px] mb-3 text-center" style={{ color: teal }}>BlockVoice Service Charge Index</p>
          <h2 className="text-xl font-bold text-white text-center mb-2">London service charges are up +56% in 5 years</h2>
          <p className="text-[13px] text-center max-w-[520px] mx-auto mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>
            We track the 7 cost components that make up your service charge — and forecast what&apos;s coming next. Here&apos;s what&apos;s driving your bill.
          </p>

          {/* Mini stacked bar showing the mix */}
          <div className="rounded-[14px] p-5 mb-4" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
            <div className="flex h-6 rounded overflow-hidden mb-4">
              {[
                { pct: 22, color: "#3b82f6", label: "Staff" },
                { pct: 17, color: "#f59e0b", label: "Insurance" },
                { pct: 12, color: "#14b8a6", label: "Amenities" },
                { pct: 10, color: "#ec4899", label: "Repairs" },
                { pct: 9, color: "#6366f1", label: "Reserve" },
                { pct: 8, color: "#ef4444", label: "Electricity" },
                { pct: 7, color: "#8b5cf6", label: "Mgmt fees" },
                { pct: 6, color: "#22c55e", label: "Cleaning" },
                { pct: 9, color: "#64748b", label: "Other" },
              ].map((s, i) => (
                <div key={i} className="relative group" style={{ width: `${s.pct}%`, background: s.color }}>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ background: "#0f1f3d", border: "1px solid #1e3a5f", color: "#fff" }}>{s.label} {s.pct}%</div>
                </div>
              ))}
            </div>

            {/* Top movers */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                <div className="text-lg font-extrabold text-amber-400">+140%</div>
                <div className="text-[10px]" style={{ color: "var(--t3)" }}>Insurance since 2021</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="text-lg font-extrabold text-red-400">+65%</div>
                <div className="text-[10px]" style={{ color: "var(--t3)" }}>Electricity peak (2023)</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <div className="text-lg font-extrabold text-blue-400">+37%</div>
                <div className="text-[10px]" style={{ color: "var(--t3)" }}>Staff costs (NLW)</div>
              </div>
            </div>

            {/* Synthetic index chart */}
            <div className="mb-4">
              <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>Market-expected growth by component (base 2021 = 100)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={getIndexChartData(SYNTHETIC_INDEX, SYNTHETIC_WEIGHTED, SYNTHETIC_YEARS)} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[80, 200]} />
                  <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                  {SYNTHETIC_INDEX.map(row => (
                    <Line key={row.component} type="monotone" dataKey={row.component} stroke={row.color} strokeWidth={1.5} dot={{ r: 2 }} />
                  ))}
                  <Line type="monotone" dataKey="Weighted Index" stroke="#1ec6a4" strokeWidth={2.5} dot={{ r: 3, fill: "#1ec6a4" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Actuals vs Synthetic comparison */}
            <div className="mb-4">
              <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>What residents actually paid vs market expectation</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ACTUALS_YEARS.map(y => ({ year: y, "What residents paid": LONDON_ACTUALS_WEIGHTED[y], "Market expectation": SYNTHETIC_WEIGHTED[y] }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[90, 170]} />
                  <Tooltip contentStyle={{ background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} />
                  <Line type="monotone" dataKey="What residents paid" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444" }} />
                  <Line type="monotone" dataKey="Market expectation" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-center mt-1" style={{ color: "var(--t3)" }}>
                Actual costs exceeded market expectations from 2023 — driven by insurance (+140%) and delayed energy contract renewals
              </p>
            </div>

            {/* Forecast teaser */}
            <div className="rounded-lg p-3" style={{ background: "rgba(30,198,164,0.06)", border: "1px solid rgba(30,198,164,0.15)" }}>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--t2)" }}>
                <strong style={{ color: teal }}>2026/27 forecast:</strong> We expect a further <strong className="text-amber-400">+3–4%</strong> increase, driven by insurance (reinsurance withdrawal) and staff costs (NLW to ~£12.50). Electricity is stabilising.
              </p>
            </div>
          </div>

          {/* Real resident data — stats + charts */}
          {scStats?.hasData && (
          <div className="rounded-[14px] p-5 mb-4" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
            <p className="text-[10px] uppercase font-semibold tracking-wider mb-3" style={{ color: "var(--t3)" }}>From real resident data in Battersea & Nine Elms</p>
            <div className="flex items-center justify-center gap-8 mb-5">
              <div className="text-center">
                <div className="text-2xl font-extrabold" style={{ color: teal }}>£{scStats.avgPerSqft?.toFixed(2)}</div>
                <div className="text-[10px]" style={{ color: "var(--t3)" }}>avg per sqft / year</div>
              </div>
              {scStats.lastYoYPct != null && (
              <>
              <div className="w-px h-10" style={{ background: "var(--border)" }} />
              <div className="text-center">
                <div className={`text-2xl font-extrabold ${scStats.lastYoYPct > 5 ? "text-red-400" : "text-amber-400"}`}>{scStats.lastYoYPct > 0 ? "+" : ""}{scStats.lastYoYPct.toFixed(1)}%</div>
                <div className="text-[10px]" style={{ color: "var(--t3)" }}>last year&apos;s increase</div>
              </div>
              <div className="w-px h-10" style={{ background: "var(--border)" }} />
              <div className="text-center">
                <div className="text-[13px] leading-snug" style={{ color: "var(--t2)" }}>
                  Charges are<br/><strong className={scStats.trend === "accelerating" ? "text-red-400" : "text-amber-400"}>{scStats.trend || "changing"}</strong>
                </div>
              </div>
              </>
              )}
            </div>

            {/* Per sqft trend chart */}
            <PerSqftChart />
          </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/service-charges" className="font-bold text-[14px] px-7 py-3 rounded-[10px] text-white" style={{ background: teal }}>
              See the full Service Charge Index
            </Link>
            <Link href="/signup" className="font-bold text-[13px] px-6 py-3 rounded-[10px]"
              style={{ color: teal, border: "1px solid rgba(30,198,164,0.3)" }}>
              Upload yours to compare
            </Link>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="px-[6%] py-10">
        <h2 className="text-xl font-bold text-white text-center mb-5">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-[720px] mx-auto">
          {[
            { step: "1", title: "Find your building", desc: "Enter your postcode and we'll match you to your development." },
            { step: "2", title: "Sign up in 30 seconds", desc: "Tell us your apartment and whether you're an owner or tenant." },
            { step: "3", title: "See everything", desc: "Your managing agent, freeholder, issues, and service charge analysis." },
          ].map(s => (
            <div key={s.step} className="rounded-xl p-[18px]" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[13px] mb-2.5 text-[#0f1f3d]" style={{ background: teal }}>{s.step}</div>
              <h3 className="text-[14px] font-bold text-white mb-1">{s.title}</h3>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--t2)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT YOU'LL SEE */}
      <section className="px-[6%] py-10">
        <h2 className="text-xl font-bold text-white text-center mb-4">What you&apos;ll see instantly</h2>
        <div className="flex flex-wrap gap-2 justify-center max-w-[640px] mx-auto">
          {["Managing agent details", "Freeholder information", "Contact numbers & email", "Building performance score", "Report & vote on issues", "Invite your neighbours"].map(t => (
            <span key={t} className="text-[12px] py-[7px] px-4 rounded-full"
              style={{ border: "1px solid rgba(30,198,164,0.4)", color: teal, background: "rgba(30,198,164,0.04)" }}>{t}</span>
          ))}
          <span className="text-[12px] py-[7px] px-4 rounded-full font-bold"
            style={{ border: "1px solid #fbbf24", color: "#fbbf24", background: "rgba(251,191,36,0.06)" }}>📊 Service charge analysis — BETA</span>
        </div>
      </section>

      {/* THIS IS JUST THE BEGINNING */}
      <section className="px-[6%] py-10 text-center">
        <h2 className="text-xl font-bold text-white mb-2">This is just the beginning</h2>
        <p className="text-[13px] max-w-[480px] mx-auto mb-5 leading-relaxed" style={{ color: "var(--t2)" }}>
          We&apos;re building tools to help leaseholders understand their buildings, hold agents accountable, and make better decisions together.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-[640px] mx-auto">
          {[
            { icon: "📄", title: "AI Document Analysis" },
            { icon: "📊", title: "Agent Scorecard" },
            { icon: "⚖️", title: "AI Complaints" },
            { icon: "🔍", title: "Charge Comparison" },
          ].map(item => (
            <div key={item.title} className="rounded-[10px] p-3.5 text-center opacity-60"
              style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-[11px] font-semibold text-white">{item.title}</div>
              <span className="inline-block mt-1.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "#334155", color: "var(--t3)" }}>Soon</span>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex justify-between items-center flex-wrap gap-2.5 px-[6%] py-5"
        style={{ background: "var(--navy)", borderTop: "1px solid var(--border)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: teal }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "var(--t3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
