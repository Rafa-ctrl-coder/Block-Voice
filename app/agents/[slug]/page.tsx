import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import agents from "@/data/agents.json";

type Agent = {
  name: string; slug: string; company_number: string; status: string;
  incorporated: string; type: string; sic_codes: string[];
  address: { line1: string; line2: string; locality: string; region: string; postal_code: string; country: string };
};

// Map agent slugs to our DB managing_agent names
const DB_AGENT_MAP: Record<string, string> = {
  "residential-management-group-limited": "RMG",
  "rendall-and-rittner-limited": "Rendall & Rittner",
  "firstport-limited": "FirstPort",
  "ballymore-asset-management-limited": "Ballymore Asset Management",
  "cushman-and-wakefield-debenham-tie-leung-limited": "Cushman & Wakefield",
};

async function getDbStats(agentName: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);

  // Find the agent in our DB
  const { data: agent } = await supabase
    .from("managing_agents")
    .select("id, name, phone, email, website, address")
    .ilike("name", agentName)
    .single();

  if (!agent) return null;

  // Count buildings managed
  const { data: links } = await supabase
    .from("development_links")
    .select("development_id, agent_confidence, developments(name, total_units, slug)")
    .eq("managing_agent_id", agent.id);

  const buildings = links || [];
  const totalUnits = buildings.reduce((sum: number, l: Record<string, unknown>) => {
    const dev = l.developments as Record<string, unknown> | null;
    return sum + (Number(dev?.total_units) || 0);
  }, 0);

  // Get avg service charge per sqft across buildings managed by this agent
  let avgPerSqft: number | null = null;
  if (buildings.length > 0) {
    const devNames = buildings
      .map((l: Record<string, unknown>) => (l.developments as Record<string, unknown>)?.name)
      .filter(Boolean) as string[];

    if (devNames.length > 0) {
      // Get all buildings with these development names
      const { data: blds } = await supabase
        .from("buildings")
        .select("id")
        .in("development_name", devNames);

      if (blds && blds.length > 0) {
        const bldIds = blds.map((b: Record<string, unknown>) => b.id as string);

        // Get annuals for these buildings
        const { data: annuals } = await supabase
          .from("service_charge_annuals")
          .select("annual_total, building_id, profile_id, has_both_halves, is_half_yearly, quarter_count")
          .in("building_id", bldIds);

        if (annuals && annuals.length > 0) {
          // Get property sizes
          const profileIds = [...new Set(annuals.map((a: Record<string, unknown>) => a.profile_id as string))];
          const { data: sizes } = await supabase
            .from("property_sizes")
            .select("profile_id, sqft")
            .in("profile_id", profileIds);

          const sizeMap = new Map((sizes || []).map((s: Record<string, unknown>) => [s.profile_id as string, s.sqft as number]));

          const perSqftValues: number[] = [];
          for (const a of annuals) {
            const sqft = sizeMap.get(a.profile_id as string);
            if (!sqft) continue;
            let annualised = Number(a.annual_total);
            const qc = Number(a.quarter_count) || 0;
            if (qc > 0 && qc < 4) annualised = (annualised / qc) * 4;
            else if (a.is_half_yearly && !a.has_both_halves) annualised = annualised * 2;
            perSqftValues.push(annualised / sqft);
          }

          if (perSqftValues.length > 0) {
            avgPerSqft = perSqftValues.reduce((a, b) => a + b, 0) / perSqftValues.length;
          }
        }
      }
    }
  }

  // Get avg rating
  const { data: ratings } = await supabase
    .from("managing_agent_ratings")
    .select("overall")
    .eq("managing_agent_id", agent.id);

  let avgRating: number | null = null;
  if (ratings && ratings.length > 0) {
    avgRating = ratings.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.overall), 0) / ratings.length;
  }

  return {
    buildingsManaged: buildings.length,
    totalUnits,
    avgPerSqft,
    avgRating,
    ratingCount: ratings?.length || 0,
    developments: buildings.map((l: Record<string, unknown>) => {
      const dev = l.developments as Record<string, unknown> | null;
      return {
        name: dev?.name as string,
        slug: dev?.slug as string,
        units: Number(dev?.total_units) || 0,
        confidence: l.agent_confidence as string,
      };
    }),
    contact: { phone: agent.phone, email: agent.email, website: agent.website, address: agent.address },
  };
}

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

  // Fetch real data from our DB if this is a known agent
  const dbName = DB_AGENT_MAP[slug];
  const dbStats = dbName ? await getDbStats(dbName) : null;

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

  const stats = [
    {
      label: "Buildings managed",
      value: dbStats ? `${dbStats.buildingsManaged}` : "—",
      sub: dbStats ? `${dbStats.totalUnits.toLocaleString()} total units` : "Data coming soon",
    },
    {
      label: "Avg service charge",
      value: dbStats?.avgPerSqft ? `£${dbStats.avgPerSqft.toFixed(2)}` : "—",
      sub: dbStats?.avgPerSqft ? "Per sqft / year" : "Data coming soon",
    },
    {
      label: "Resident rating",
      value: dbStats?.avgRating ? `${dbStats.avgRating.toFixed(1)} / 5` : "—",
      sub: dbStats?.ratingCount ? `${dbStats.ratingCount} rating${dbStats.ratingCount !== 1 ? "s" : ""}` : "No ratings yet",
    },
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

        {/* BUILDINGS MANAGED */}
        {dbStats && dbStats.developments.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Buildings Managed on BlockVoice</h2>
            <div className="space-y-2">
              {dbStats.developments.map(dev => (
                <Link key={dev.slug} href={`/buildings/${dev.slug}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <span className="text-[13px] font-semibold text-white">{dev.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>{dev.units} units</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={dev.confidence === "confirmed"
                      ? { background: "rgba(45,212,168,0.12)", color: "#2DD4A8", border: "1px solid rgba(45,212,168,0.25)" }
                      : { background: "rgba(226,159,39,0.12)", color: "#EF9F27", border: "1px solid rgba(226,159,39,0.25)" }}>
                    {dev.confidence}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* SERVICE CHARGE COMPARISON */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Service Charge Comparison</h2>
          {dbStats?.avgPerSqft ? (
            <>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-white font-semibold">{name}</span>
                    <span style={{ color: "#2DD4A8" }}>£{dbStats.avgPerSqft.toFixed(2)}/sqft</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-3 rounded-full" style={{ width: `${Math.min((dbStats.avgPerSqft / 15) * 100, 100)}%`, background: "#2DD4A8" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Battersea average</span>
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>£9.50/sqft</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-3 rounded-full" style={{ width: `${(9.5 / 15) * 100}%`, background: "rgba(255,255,255,0.2)" }} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                Based on resident-uploaded service charge data. Regional average is indicative.
              </p>
            </>
          ) : (
            <>
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
              </div>
              <p className="text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                Service charge data will appear here as residents upload their documents. Join BlockVoice to contribute.
              </p>
            </>
          )}
        </div>

        {/* CONTACT DETAILS */}
        {dbStats?.contact && (dbStats.contact.phone || dbStats.contact.email) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: "#112236", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-[11px] uppercase font-bold tracking-[1.5px] mb-4" style={{ color: "#2DD4A8" }}>Contact Details</h2>
            <div className="space-y-2">
              {dbStats.contact.phone && (
                <div className="flex gap-4">
                  <span className="text-[12px] w-[80px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Phone</span>
                  <a href={`tel:${dbStats.contact.phone}`} className="text-[13px]" style={{ color: "#2DD4A8" }}>{dbStats.contact.phone}</a>
                </div>
              )}
              {dbStats.contact.email && (
                <div className="flex gap-4">
                  <span className="text-[12px] w-[80px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Email</span>
                  <a href={`mailto:${dbStats.contact.email}`} className="text-[13px]" style={{ color: "#2DD4A8" }}>{dbStats.contact.email}</a>
                </div>
              )}
              {dbStats.contact.website && (
                <div className="flex gap-4">
                  <span className="text-[12px] w-[80px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Website</span>
                  <a href={`https://${dbStats.contact.website}`} target="_blank" rel="noopener noreferrer" className="text-[13px]" style={{ color: "#2DD4A8" }}>{dbStats.contact.website}</a>
                </div>
              )}
              {dbStats.contact.address && (
                <div className="flex gap-4">
                  <span className="text-[12px] w-[80px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Office</span>
                  <span className="text-[13px] text-white">{dbStats.contact.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

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
