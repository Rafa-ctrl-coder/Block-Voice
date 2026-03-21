"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Candidate { slug: string; name: string; totalUnits: number }
interface Address { line_1: string; line_2: string; building_name: string; sub_building_name: string; thoroughfare: string; post_town: string }

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
            placeholder="Enter your postcode e.g. SW11 8BW"
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

      {/* INFO STRIP */}
      <div className="flex items-center flex-wrap gap-3 justify-center px-[6%] py-4"
        style={{ background: "var(--navy-mid)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--t3)" }}>What you&apos;ll see instantly</span>
        <div className="flex flex-wrap gap-[6px] justify-center">
          {["Managing agent", "Freeholder details", "Contact information", "Building performance score", "Your documents"].map(c => (
            <span key={c} className="text-[10px] font-semibold px-[10px] py-[3px] rounded-full whitespace-nowrap"
              style={{ background: "var(--teal-dim)", border: "1px solid var(--teal-border)", color: teal }}>{c}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section className="px-[6%] py-[72px]">
        <p className="text-[10px] uppercase font-semibold mb-2.5 tracking-[1.8px]" style={{ color: teal }}>What BlockVoice does</p>
        <h2 className="font-extrabold leading-[1.12] mb-2.5 tracking-[-0.5px]" style={{ fontSize: "clamp(22px, 2.8vw, 34px)" }}>
          Your building, managed<br />like it should be
        </h2>
        <p className="max-w-[480px] mb-10 leading-relaxed" style={{ color: "var(--t2)", fontSize: "15px" }}>
          A central dashboard for everything related to your leasehold property — from who&apos;s responsible to what you&apos;re owed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: "🏢", title: "Building transparency", desc: "Instantly see your managing agent, freeholder, and their contact details. Know who's responsible for what — and how to reach them directly.", tag: "Live now" },
            { icon: "📄", title: "Your documents, explained", desc: "Upload your lease, service charge statements, and notices. AI breaks down what they mean in plain English so you're never left guessing." },
            { icon: "💷", title: "Service charge analysis", desc: "See exactly what you're paying for, whether it's reasonable, and how your costs compare to similar buildings and managing agents." },
            { icon: "📊", title: "Building performance tracking", desc: "Track how your building and managing agent are rated over time — maintenance response, communication, value for money, and more." },
            { icon: "⚡", title: "AI-assisted issue raising", desc: "When something isn't right, BlockVoice helps you raise it correctly — drafting formal communications and guiding you through the right legal channels." },
            { icon: "🔔", title: "Alerts & updates", desc: "Get notified about works planned for your building, changes to your management, or anything that affects your service charge." },
          ].map(f => (
            <div key={f.title} className="rounded-xl p-[22px] transition-colors hover:border-[rgba(30,198,164,0.25)]"
              style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[16px] mb-3.5"
                style={{ background: "var(--teal-dim)", border: "1px solid var(--teal-border)" }}>{f.icon}</div>
              <h3 className="text-[13px] font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--t2)" }}>{f.desc}</p>
              {f.tag && (
                <span className="inline-block mt-2 text-[9px] uppercase font-bold px-2 py-[2px] rounded-full tracking-[0.8px]"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>{f.tag}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* BENCHMARKING */}
      <section className="px-[6%] py-[72px]" style={{ background: "var(--navy-mid)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-[920px]">
          <div>
            <p className="text-[10px] uppercase font-semibold mb-2.5 tracking-[1.8px]" style={{ color: teal }}>Benchmarking</p>
            <h2 className="font-extrabold leading-[1.12] mb-2.5 tracking-[-0.5px]" style={{ fontSize: "clamp(22px, 2.8vw, 34px)" }}>
              See how your building really compares
            </h2>
            <p className="max-w-[400px] leading-relaxed" style={{ color: "var(--t2)", fontSize: "15px" }}>
              Most leaseholders have no idea if their service charges are reasonable or if their managing agent is any good. BlockVoice benchmarks your building against thousands of others so you have real data — not just a hunch.
            </p>
          </div>
          <div className="rounded-[12px] p-5" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
            <p className="text-[12px] font-semibold mb-4" style={{ color: "var(--t2)" }}>Managing agent performance — your area</p>
            {[
              { name: "Your building", you: true, width: "62%", score: "6.2", color: teal },
              { name: "Avg. SW11", width: "71%", score: "7.1", color: "rgba(255,255,255,0.2)" },
              { name: "Top 10%", width: "91%", score: "9.1", color: "#4ade80" },
              { name: "Bottom 10%", width: "31%", score: "3.1", color: "#f87171" },
            ].map(row => (
              <div key={row.name} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
                <span className={"text-[11px] w-[85px] flex-shrink-0 " + (row.you ? "text-white font-semibold" : "")} style={{ color: row.you ? undefined : "var(--t2)" }}>
                  {row.name}
                  {row.you && <span className="ml-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-[0.8px]"
                    style={{ background: "var(--teal-dim)", color: teal }}>you</span>}
                </span>
                <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-[7px] rounded-full" style={{ width: row.width, background: row.color }} />
                </div>
                <span className="text-[11px] font-bold text-white w-6 text-right flex-shrink-0">{row.score}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOCUMENT INTELLIGENCE */}
      <section className="px-[6%] py-[72px]" style={{ background: "var(--navy)" }}>
        <p className="text-[10px] uppercase font-semibold mb-2.5 tracking-[1.8px]" style={{ color: teal }}>Document intelligence</p>
        <h2 className="font-extrabold leading-[1.12] mb-2.5 tracking-[-0.5px]" style={{ fontSize: "clamp(22px, 2.8vw, 34px)" }}>
          Your paperwork, finally decoded
        </h2>
        <p className="max-w-[480px] mb-10 leading-relaxed" style={{ color: "var(--t2)", fontSize: "15px" }}>
          Upload any document related to your building and BlockVoice tells you what it means, what your rights are, and what to watch out for.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { type: "Service charge", bg: "rgba(79,142,247,0.12)", color: "#7eb3fa", border: "rgba(79,142,247,0.25)", name: "2024-25 statement", insight: "Management fee is 18% above the average for comparable buildings in your postcode." },
            { type: "Lease", bg: "rgba(167,139,250,0.12)", color: "#c4b5fd", border: "rgba(167,139,250,0.25)", name: "Your lease agreement", insight: "83 years remaining. Ground rent review clause in section 7 may require attention." },
            { type: "Notice", bg: "rgba(251,191,36,0.12)", color: "#fcd34d", border: "rgba(251,191,36,0.25)", name: "Section 20 consultation", insight: "You have 30 days to respond. Works estimated at £3,200 per unit — you can challenge this." },
            { type: "Certificate", bg: "rgba(52,211,153,0.12)", color: "#6ee7b7", border: "rgba(52,211,153,0.25)", name: "Buildings insurance", insight: "Reinstatement value appears in line with market rates. Policy renewal due April 2025." },
          ].map(doc => (
            <div key={doc.name} className="rounded-xl p-5 flex flex-col gap-2"
              style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <span className="inline-block w-fit text-[9px] uppercase font-bold px-2 py-[2px] rounded-full tracking-[1px]"
                style={{ background: doc.bg, color: doc.color, border: `1px solid ${doc.border}` }}>{doc.type}</span>
              <span className="text-[13px] font-bold text-white">{doc.name}</span>
              <div className="pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[9px] uppercase font-bold mb-[2px] tracking-[0.5px]" style={{ color: teal }}>AI insight</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--t2)" }}>{doc.insight}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMING SOON STRIP */}
      <div className="px-[6%] py-14 text-center"
        style={{ background: "var(--navy-mid)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <p className="max-w-[520px] mx-auto leading-[1.7]" style={{ color: "var(--t2)", fontSize: "15px" }}>
          This is just the beginning. <strong className="text-white font-semibold">Document analysis, service charge benchmarking, AI-assisted issue raising, managing agent ratings</strong> and more are all in development — sign up now to be first in line.
        </p>
      </div>

      {/* CTA */}
      <section className="px-[6%] py-20 text-center">
        <h2 className="font-extrabold leading-[1.12] mb-2.5 tracking-[-0.5px]" style={{ fontSize: "clamp(22px, 2.8vw, 34px)" }}>
          Finally understand your building.
        </h2>
        <p className="max-w-[480px] mx-auto mb-8 leading-relaxed" style={{ color: "var(--t2)", fontSize: "15px" }}>
          Join residents already using BlockVoice to get clarity on who manages their building, what they&apos;re paying, and what their rights are.
        </p>
        <Link href="/signup" className="inline-block font-bold text-[14px] px-9 py-[13px] rounded-[10px] text-white" style={{ background: teal }}>
          Find my building — it&apos;s free
        </Link>
        <p className="mt-2.5 text-[11px]" style={{ color: "var(--t3)" }}>No card required. Takes under 2 minutes.</p>
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
