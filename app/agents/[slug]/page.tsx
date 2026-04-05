import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import agents from "@/data/agents.json";

type Agent = {
  name: string; slug: string; company_number: string; status: string;
  incorporated: string; type: string; sic_codes: string[];
  address: { line1: string; line2: string; locality: string; region: string; postal_code: string; country: string };
};

export function generateStaticParams() {
  return (agents as Agent[]).filter(a => a.status === "active").map(a => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const agent = (agents as Agent[]).find(a => a.slug === slug);
    if (!agent) return { title: "Agent Not Found — BlockVoice" };
    const name = formatName(agent.name);
    return {
      title: `${name} — Managing Agent Profile | BlockVoice`,
      description: `View ${name}'s company details, service charge data, and tribunal history. Compare with other managing agents on BlockVoice.`,
      openGraph: {
        title: `${name} — Managing Agent Profile | BlockVoice`,
        description: `View ${name}'s company details, service charge data, and tribunal history. Compare with other managing agents on BlockVoice.`,
        url: `https://blockvoice.co.uk/agents/${slug}`,
        type: "profile",
      },
      alternates: { canonical: `https://blockvoice.co.uk/agents/${slug}` },
    };
  });
}

function formatName(name: string) {
  return name.replace(/\b(LIMITED|LTD|PLC|LLP|GROUP|HOLDINGS)\b/gi, (m) => m.charAt(0) + m.slice(1).toLowerCase());
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatAddress(addr: Agent["address"]) {
  return [addr.line1, addr.line2, addr.locality, addr.region, addr.postal_code, addr.country].filter(Boolean).join(", ");
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = (agents as Agent[]).find(a => a.slug === slug);
  if (!agent) notFound();

  const name = formatName(agent.name);
  const region = agent.address.locality || agent.address.region || "UK";
  const isActive = agent.status === "active";

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: agent.name,
    url: `https://blockvoice.co.uk/agents/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: [agent.address.line1, agent.address.line2].filter(Boolean).join(", "),
      addressLocality: agent.address.locality,
      addressRegion: agent.address.region,
      postalCode: agent.address.postal_code,
      addressCountry: agent.address.country || "GB",
    },
    identifier: { "@type": "PropertyValue", name: "Companies House Number", value: agent.company_number },
  };

  // Placeholder stats
  const stats = [
    { label: "Buildings managed", value: "—", sub: "Data coming soon" },
    { label: "Avg service charge", value: "—", sub: "Per sqft / year" },
    { label: "Tribunal cases", value: "—", sub: "Coming soon" },
  ];

  // Placeholder tribunal cases
  const tribunalCases = [
    { date: "Coming soon", description: "Tribunal case data will be available shortly.", outcome: "pending" as const },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0B1A2B", color: "#fff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-[6%] h-14" style={{ background: "#0B1A2B", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/" className="font-extrabold text-[17px]" style={{ color: "#2DD4A8" }}>BlockVoice</Link>
        <div className="flex items-center gap-5">
          <Link href="/login" className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Sign In</Link>
          <Link href="/signup" className="font-bold text-[12px] px-4 py-[7px] rounded-lg" style={{ background: "#2DD4A8", color: "#0B1A2B" }}>Join free</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* BREADCRUMB */}
        <div className="flex items-center gap-1.5 text-[12px] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
          <Link href="/agents" className="hover:text-white transition-colors">Managing agents</Link>
          <span>→</span>
          <span>{region}</span>
          <span>→</span>
          <span className="text-white">{name}</span>
        </div>

        {/* HEADER */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-extrabold text-white leading-tight" style={{ letterSpacing: "-0.8px" }}>{name}</h1>
            <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-full flex-shrink-0"
              style={isActive
                ? { background: "rgba(45,212,168,0.12)", color: "#2DD4A8", border: "1px solid rgba(45,212,168,0.25)" }
                : { background: "rgba(226,75,74,0.12)", color: "#E24B4A", border: "1px solid rgba(226,75,74,0.25)" }}>
              {isActive ? "Active" : "Dissolved"}
            </span>
          </div>
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Property management company · {region}
          </p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-xl font-extrabold text-white mb-0.5">{s.value}</div>
              <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* COMPANIES HOUSE DATA */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Companies House Data</h2>
          <div className="space-y-3">
            {[
              { label: "Company number", value: agent.company_number },
              { label: "Incorporated", value: formatDate(agent.incorporated) },
              { label: "Registered address", value: formatAddress(agent.address) },
              { label: "Company type", value: agent.type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
              { label: "Status", value: agent.status.charAt(0).toUpperCase() + agent.status.slice(1) },
              ...(agent.sic_codes.length > 0 ? [{ label: "SIC codes", value: agent.sic_codes.join(", ") }] : []),
            ].map(row => (
              <div key={row.label} className="flex items-start gap-4">
                <span className="text-[12px] font-semibold w-[140px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                <span className="text-[13px] text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SERVICE CHARGE COMPARISON */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Service Charge Comparison</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-white font-semibold">{name}</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Data pending</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-3 rounded-full" style={{ width: "0%", background: "#2DD4A8" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Regional average</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Data pending</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-3 rounded-full" style={{ width: "0%", background: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
          </div>
          <p className="text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
            Service charge comparison data is being compiled from resident uploads. Check back soon.
          </p>
        </div>

        {/* TRIBUNAL CASES */}
        <div className="rounded-xl p-5 mb-8" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Tribunal Cases</h2>
          {tribunalCases.map((tc, i) => (
            <div key={i} className="flex items-start gap-3 py-2" style={{ borderBottom: i < tribunalCases.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <span className="text-[11px] w-[80px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{tc.date}</span>
              <span className="text-[13px] flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{tc.description}</span>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0"
                style={tc.outcome === "pending"
                  ? { background: "rgba(226,159,39,0.12)", color: "#EF9F27", border: "1px solid rgba(226,159,39,0.25)" }
                  : { background: "rgba(226,75,74,0.12)", color: "#E24B4A", border: "1px solid rgba(226,75,74,0.25)" }}>
                {tc.outcome}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-xl p-6 text-center" style={{ background: "linear-gradient(135deg, rgba(45,212,168,0.1) 0%, rgba(45,212,168,0.02) 100%)", border: "1px solid rgba(45,212,168,0.25)" }}>
          <h2 className="text-lg font-bold text-white mb-2">Is {name} your managing agent?</h2>
          <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Join BlockVoice to rate them, compare service charges, and connect with other residents managed by {name}.
          </p>
          <Link href="/signup" className="inline-block font-bold text-[14px] px-8 py-3 rounded-[10px]"
            style={{ background: "#2DD4A8", color: "#0B1A2B" }}>
            Join BlockVoice — it&apos;s free
          </Link>
          <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>Free forever · 30 seconds · No paperwork</p>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="flex justify-between items-center flex-wrap gap-2 px-[6%] py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="font-extrabold text-[14px]" style={{ color: "#2DD4A8" }}>BlockVoice</div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>© 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
