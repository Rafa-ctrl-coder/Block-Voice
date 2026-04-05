import type { Metadata } from "next";
import Link from "next/link";
import { SYNTHETIC_INDEX, SYNTHETIC_WEIGHTED, SYNTHETIC_YEARS, LONDON_ACTUALS_INDEX, LONDON_ACTUALS_WEIGHTED, ACTUALS_YEARS, ESTATES, TRIBUNAL_CASES } from "./data";
import { SyntheticIndexSection, LondonActualsSection, EstateBreakdownSection, TribunalAdjustmentsSection } from "./components";

export const metadata: Metadata = {
  title: "London Service Charge Index 2025 — Cost Trends & Benchmarks | BlockVoice",
  description: "Track how London service charges have changed since 2021. See utilities, insurance, staffing and management cost trends with real data from resident submissions and tribunal outcomes.",
  openGraph: {
    title: "London Service Charge Index 2025 | BlockVoice",
    description: "Service charges in London are up 41.2% in 5 years — outpacing CPI by 10%. See the full breakdown by component, building, and tribunal outcome.",
    url: "https://blockvoice.co.uk/service-charges",
    type: "article",
  },
  alternates: { canonical: "https://blockvoice.co.uk/service-charges" },
};

export default function ServiceChargesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "London Service Charge Index",
    description: "Tracking service charge cost trends across London residential developments since 2021",
    url: "https://blockvoice.co.uk/service-charges",
    creator: { "@type": "Organization", name: "BlockVoice", url: "https://blockvoice.co.uk" },
    temporalCoverage: "2021/2026",
    keywords: ["service charge", "leasehold", "managing agent", "London", "insurance", "utilities"],
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--navy)", color: "var(--t1)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-[6%] h-[56px]"
        style={{ background: "var(--navy)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/" className="font-extrabold text-[17px]" style={{ color: "var(--teal)" }}>BlockVoice</Link>
        <div className="flex items-center gap-5">
          <Link href="/service-charges" className="text-[13px] font-semibold text-white">Service Charge Index</Link>
          <Link href="/agents" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Managing Agents</Link>
          <Link href="/login" className="text-[13px] font-medium" style={{ color: "var(--t2)" }}>Sign In</Link>
          <Link href="/signup" className="font-bold text-[12px] px-4 py-[7px] rounded-lg text-white" style={{ background: "var(--teal)" }}>Join free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-[6%] pt-16 pb-12 text-center" style={{ background: "var(--navy)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(30,198,164,0.06) 0%, transparent 70%)" }} />
        <p className="text-[11px] font-semibold uppercase tracking-[1.2px] mb-4" style={{ color: "var(--teal)" }}>BlockVoice Data Hub</p>
        <h1 className="font-extrabold text-white leading-[1.08] mb-4 tracking-[-1.5px]" style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
          London Service Charge Index
        </h1>
        <p className="mx-auto mb-3 max-w-[540px] leading-relaxed" style={{ color: "var(--t2)", fontSize: "clamp(14px, 1.4vw, 16px)" }}>
          How are service charges changing across London? We track the key cost drivers — utilities, insurance, staffing, and management fees — using market data and real resident submissions.
        </p>
        <div className="flex items-center justify-center gap-6 mt-6 mb-4">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-red-400">+41.2%</div>
            <div className="text-[11px]" style={{ color: "var(--t3)" }}>5-year growth</div>
          </div>
          <div className="w-px h-10" style={{ background: "var(--border)" }} />
          <div className="text-center">
            <div className="text-3xl font-extrabold text-white">£2,801</div>
            <div className="text-[11px]" style={{ color: "var(--t3)" }}>avg London annual charge</div>
          </div>
          <div className="w-px h-10" style={{ background: "var(--border)" }} />
          <div className="text-center">
            <div className="text-3xl font-extrabold text-amber-400">+10.3%</div>
            <div className="text-[11px]" style={{ color: "var(--t3)" }}>above CPI</div>
          </div>
        </div>
      </section>

      {/* SECTIONS */}
      <SyntheticIndexSection index={SYNTHETIC_INDEX} weighted={SYNTHETIC_WEIGHTED} years={SYNTHETIC_YEARS} />
      <LondonActualsSection index={LONDON_ACTUALS_INDEX} weighted={LONDON_ACTUALS_WEIGHTED} years={ACTUALS_YEARS} syntheticWeighted={SYNTHETIC_WEIGHTED} />
      <EstateBreakdownSection estates={ESTATES} />
      <TribunalAdjustmentsSection cases={TRIBUNAL_CASES} />

      {/* CTA */}
      <section className="px-[6%] py-16 text-center">
        <div className="max-w-[600px] mx-auto rounded-[14px] p-8"
          style={{ background: "linear-gradient(135deg, rgba(30,198,164,0.1) 0%, rgba(30,198,164,0.02) 100%)", border: "1px solid rgba(30,198,164,0.25)" }}>
          <h2 className="text-xl font-bold text-white mb-2">How do your charges compare?</h2>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: "var(--t2)" }}>
            Upload your service charge documents and see how your building compares to these indices. Free, takes 30 seconds, and helps build the most transparent dataset of service charges in London.
          </p>
          <Link href="/signup" className="inline-block font-bold text-[15px] px-8 py-3.5 rounded-[10px] text-white" style={{ background: "var(--teal)" }}>
            Join BlockVoice — it&apos;s free
          </Link>
          <p className="text-[11px] mt-3" style={{ color: "var(--t3)" }}>Your data contributes to the London Actuals Index anonymously.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex justify-between items-center flex-wrap gap-2.5 px-[6%] py-5"
        style={{ background: "var(--navy)", borderTop: "1px solid var(--border)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: "var(--teal)" }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "var(--t3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
