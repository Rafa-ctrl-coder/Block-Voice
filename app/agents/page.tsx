import Link from "next/link";
import type { Metadata } from "next";
import agents from "@/data/agents.json";

export const metadata: Metadata = {
  title: "Managing Agent Directory — BlockVoice",
  description: "Browse UK managing agents. View company details, service charge data, and tribunal history. Compare agents on BlockVoice.",
  openGraph: {
    title: "Managing Agent Directory — BlockVoice",
    description: "Browse UK managing agents. View company details, service charge data, and tribunal history.",
    url: "https://blockvoice.co.uk/agents",
  },
};

function formatName(name: string) {
  return name.replace(/\b(LIMITED|LTD|PLC|LLP|GROUP)\b/gi, (m) => m.charAt(0) + m.slice(1).toLowerCase());
}

export default function AgentsIndex() {
  const active = agents.filter((a: { status: string }) => a.status === "active");
  const sorted = [...active].sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen" style={{ background: "#0B1A2B", color: "#fff" }}>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-[6%] h-14" style={{ background: "#0B1A2B", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/" className="font-extrabold text-[17px]" style={{ color: "#2DD4A8" }}>BlockVoice</Link>
        <div className="flex items-center gap-5">
          <Link href="/login" className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Sign In</Link>
          <Link href="/signup" className="font-bold text-[12px] px-4 py-[7px] rounded-lg" style={{ background: "#2DD4A8", color: "#0B1A2B" }}>Join free</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-[11px] uppercase font-semibold tracking-[1.5px] mb-3" style={{ color: "#2DD4A8" }}>Managing Agent Directory</p>
        <h1 className="text-3xl font-extrabold text-white mb-2" style={{ letterSpacing: "-1px" }}>UK Managing Agents</h1>
        <p className="text-[15px] mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
          {sorted.length} managing agents and property companies. View company details, service charge data, and resident ratings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((agent: { slug: string; name: string; company_number: string; status: string; address: { locality: string; region: string } }) => (
            <Link key={agent.slug} href={`/agents/${agent.slug}`}
              className="rounded-xl p-4 transition-colors hover:border-[#2DD4A8]/40"
              style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="font-bold text-white text-[14px] mb-1 leading-tight">{formatName(agent.name)}</h2>
              <p className="text-[11px] mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                {agent.company_number} · {agent.address.locality || agent.address.region || "UK"}
              </p>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                style={{ background: "rgba(45,212,168,0.12)", color: "#2DD4A8", border: "1px solid rgba(45,212,168,0.25)" }}>
                Active
              </span>
            </Link>
          ))}
        </div>
      </div>

      <footer className="flex justify-between items-center flex-wrap gap-2 px-[6%] py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: "#2DD4A8" }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
