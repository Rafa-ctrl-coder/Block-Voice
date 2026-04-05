// ─── Index Component Types ───────────────────────────────────────────────────

export interface IndexRow {
  component: string;
  weight: number; // decimal (e.g. 0.25)
  values: Record<string, number>; // year → index value (base 2021 = 100)
  color: string;
  explanation: string;
  sources: string[];
}

export interface EstateLineItem {
  category: string;
  values: Record<string, number>; // year → £ amount
  indexComparison: "above" | "below" | "inline";
  shouldChallenge: boolean;
  challengeReason?: string;
}

export interface EstateData {
  name: string;
  slug: string;
  years: string[];
  totalExpenditure: Record<string, number>;
  growthPct: number;
  lineItems: EstateLineItem[];
}

export interface TribunalDemand {
  item: string;
  demanded: number;
  adjusted: number;
  note: string;
}

export interface TribunalCase {
  building: string;
  reference?: string;
  demands: TribunalDemand[];
  summary: string;
}

// ─── 1. Synthetic Market Index ──────────────────────────────────────────────

export const SYNTHETIC_INDEX: IndexRow[] = [
  {
    component: "Staff & Concierge",
    weight: 0.22,
    color: "#3b82f6",
    values: { "2021": 100, "2022": 107, "2023": 117, "2024": 128, "2025": 137, "2026": 142 },
    explanation: "Concierge, security, and on-site staff costs track closely with the National Living Wage (NLW), which has risen from £8.91 (2021) to £12.21 (2025) — a 37% increase. Employer NICs increased in April 2025, adding further pressure. Staff retention challenges have led to agency premium costs. The 2026 estimate assumes a further NLW increase to ~£12.50 and continued NIC pressure.",
    sources: ["Gov.uk National Living Wage announcements", "ONS Average Weekly Earnings", "HMRC employer NIC rates"],
  },
  {
    component: "Insurance",
    weight: 0.17,
    color: "#f59e0b",
    values: { "2021": 100, "2022": 130, "2023": 160, "2024": 170, "2025": 178, "2026": 185 },
    explanation: "Buildings insurance premiums have risen relentlessly since 2021, driven by the post-Grenfell cladding crisis, reinsurance capacity withdrawal from UK residential, and rising reinstatement cost estimates. Insurers are pricing in fire safety remediation uncertainty, EWS1 survey requirements, and higher rebuild costs. Many new-build developments have seen premiums double or triple.",
    sources: ["ABI buildings insurance data", "FCA General Insurance report 2024", "RICS Reinstatement Cost Assessment"],
  },
  {
    component: "Amenities",
    weight: 0.12,
    color: "#14b8a6",
    values: { "2021": 100, "2022": 105, "2023": 112, "2024": 118, "2025": 122, "2026": 126 },
    explanation: "Gym, pool, and communal leisure facility costs are driven by equipment maintenance contracts, energy consumption (pool heating, gym HVAC), and specialist cleaning. New-build developments with premium amenities (Vista, Embassy Gardens, BPS) see 10-15% of total charges allocated here. Growth is moderate and contract-driven.",
    sources: ["BlockVoice submitted accounts", "Managing agent contract data"],
  },
  {
    component: "Electricity",
    weight: 0.08,
    color: "#ef4444",
    values: { "2021": 100, "2022": 180, "2023": 250, "2024": 175, "2025": 160, "2026": 165 },
    explanation: "Commercial electricity prices surged 80–150% in 2022–23 as wholesale markets spiked following the Russia-Ukraine conflict. Fixed-rate contracts rolled off into peak pricing throughout 2023. By 2024, wholesale prices fell but remain elevated. Buildings on variable tariffs saw the sharpest increases; those on longer fixed deals experienced delayed but steep renewals.",
    sources: ["Ofgem price cap data", "Cornwall Insight wholesale forecasts", "BEIS energy statistics"],
  },
  {
    component: "Repairs & Maintenance",
    weight: 0.10,
    color: "#ec4899",
    values: { "2021": 100, "2022": 115, "2023": 125, "2024": 130, "2025": 135, "2026": 140 },
    explanation: "Electrical, mechanical, lift, and general maintenance costs are driven by construction labour inflation, specialist contractor availability, and ageing building systems. Costs are inherently lumpy — a lift replacement or boiler overhaul can spike one year's charge. Buildings under 10 years old generally see lower reactive maintenance but higher defect rectification costs.",
    sources: ["RICS Building Cost Information Service", "ONS Construction Output Price Index"],
  },
  {
    component: "Reserve Fund",
    weight: 0.09,
    color: "#6366f1",
    values: { "2021": 100, "2022": 100, "2023": 100, "2024": 105, "2025": 108, "2026": 110 },
    explanation: "Reserve fund contributions are typically set by a planned maintenance schedule (20-30 year programme) and remain relatively flat year to year. Some managing agents have begun increasing contributions to reflect higher future costs for major works (roof, façade, mechanical plant). This is not a 'cost' but a savings pot — though it appears on your statement as an expense.",
    sources: ["RICS Service Charge Residential Management Code", "Leasehold Advisory Service guidance"],
  },
  {
    component: "Management Fees",
    weight: 0.07,
    color: "#8b5cf6",
    values: { "2021": 100, "2022": 109, "2023": 117, "2024": 121, "2025": 124, "2026": 127 },
    explanation: "Managing agent fees typically include RPI or CPI-linked annual increases. Growth has tracked slightly above CPI due to consolidation in the property management sector, regulatory burden from the Building Safety Act, and increased compliance requirements. Some agents have introduced supplementary charges for fire safety administration.",
    sources: ["ONS CPI data", "ARMA/IRPM industry reports", "Building Safety Act 2022"],
  },
  {
    component: "Cleaning & Grounds",
    weight: 0.06,
    color: "#22c55e",
    values: { "2021": 100, "2022": 108, "2023": 115, "2024": 120, "2025": 125, "2026": 130 },
    explanation: "Cleaning contracts, window cleaning, gardening, and landscaping costs track labour markets (NLW) and chemical/material costs. Contract renewals typically see 5-8% uplifts. Developments with extensive communal areas and gardens see higher absolute costs but similar growth rates.",
    sources: ["British Cleaning Council wage data", "Landscape Institute contract benchmarks"],
  },
  {
    component: "Water & Other",
    weight: 0.09,
    color: "#64748b",
    values: { "2021": 100, "2022": 105, "2023": 110, "2024": 118, "2025": 125, "2026": 130 },
    explanation: "Water rates, communal phone lines, CCTV, fire safety equipment, pest control, and sundry costs. Water bills have been rising above inflation due to infrastructure investment by water companies. CCTV and fire safety testing costs are largely stable but regulatory changes (Fire Safety Act) have added new compliance costs.",
    sources: ["Ofwat price determination", "Fire Safety Act 2021 impact assessments"],
  },
];

export const SYNTHETIC_WEIGHTED: Record<string, number> = {
  "2021": 100, "2022": 115, "2023": 134, "2024": 139, "2025": 144, "2026": 149,
};

export const SYNTHETIC_YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

// ─── 2. London Actuals Index ────────────────────────────────────────────────

export const LONDON_ACTUALS_INDEX: IndexRow[] = [
  {
    component: "Staff & Concierge",
    weight: 0.22,
    color: "#3b82f6",
    values: { "2021": 100, "2022": 100, "2023": 105, "2024": 115, "2025": 125 },
    explanation: "Staff costs in actual accounts show a delayed response — many buildings held wages flat in 2022 but then faced catch-up increases in 2023–24 as retention became difficult. Agency and overtime costs have increased faster than base wages. Some buildings switched from in-house to outsourced concierge, creating one-off cost jumps.",
    sources: ["BlockVoice submitted accounts", "London Living Wage Foundation data"],
  },
  {
    component: "Insurance",
    weight: 0.17,
    color: "#f59e0b",
    values: { "2021": 100, "2022": 115, "2023": 210, "2024": 225, "2025": 240 },
    explanation: "Insurance is the single biggest driver of actual service charge increases. The 'contract lag' hid the true impact until 2023, when many buildings saw premiums more than double on renewal. The gap between our synthetic index (178) and actuals (240) in 2025 reflects the severity of the London high-rise insurance crisis — far worse than macro models predicted.",
    sources: ["BlockVoice submitted accounts", "London Fire Brigade building data", "FCA leaseholder complaints"],
  },
  {
    component: "Amenities",
    weight: 0.12,
    color: "#14b8a6",
    values: { "2021": 100, "2022": 103, "2023": 110, "2024": 120, "2025": 125 },
    explanation: "Gym and pool costs saw modest increases in 2022–23 but spiked in 2024 as energy costs for pool heating and gym HVAC fed through. Equipment replacement cycles also contributed. Buildings without premium amenities see this category at near zero.",
    sources: ["BlockVoice submitted accounts"],
  },
  {
    component: "Electricity",
    weight: 0.08,
    color: "#ef4444",
    values: { "2021": 100, "2022": 105, "2023": 145, "2024": 150, "2025": 140 },
    explanation: "Actual electricity costs lagged the wholesale market due to fixed-rate contracts. Many buildings only saw the full impact in 2023 when contracts renewed at peak rates. The 2024 figure reflects deficit recovery from underfunded 2022 budgets. 2025 shows modest relief as new contracts lock in lower rates.",
    sources: ["BlockVoice submitted accounts", "London shared accounts analysis"],
  },
  {
    component: "Repairs & Maintenance",
    weight: 0.10,
    color: "#ec4899",
    values: { "2021": 100, "2022": 120, "2023": 135, "2024": 140, "2025": 145 },
    explanation: "Reactive maintenance costs jumped sharply in 2022 as pandemic-deferred works were addressed. Electrical and lift repairs show the most volatility. Newer buildings (post-2015) are seeing rising defect rectification costs as warranties expire.",
    sources: ["BlockVoice submitted accounts", "RICS Building Maintenance benchmarks"],
  },
  {
    component: "Reserve Fund",
    weight: 0.09,
    color: "#6366f1",
    values: { "2021": 100, "2022": 100, "2023": 100, "2024": 110, "2025": 115 },
    explanation: "Reserve fund contributions were largely flat until 2024 when several managing agents increased contributions citing higher projected costs for planned maintenance. Some buildings have seen 10-15% uplifts to reflect construction inflation in future major works estimates.",
    sources: ["BlockVoice submitted accounts"],
  },
  {
    component: "Management Fees",
    weight: 0.07,
    color: "#8b5cf6",
    values: { "2021": 100, "2022": 105, "2023": 120, "2024": 150, "2025": 135 },
    explanation: "Management fees spiked in 2024 as agents passed through Building Safety Act compliance costs. The 2025 reduction reflects residents challenging supplementary fees at tribunal or through RTM processes. The gap between synthetic (124) and actuals (135) suggests agents are pricing above inflation.",
    sources: ["BlockVoice submitted accounts", "First-tier Tribunal decisions", "LEASE case data"],
  },
  {
    component: "Cleaning & Grounds",
    weight: 0.06,
    color: "#22c55e",
    values: { "2021": 100, "2022": 105, "2023": 115, "2024": 120, "2025": 128 },
    explanation: "Cleaning and gardening contracts saw moderate increases tracking NLW. Some buildings saw larger jumps when contracts were retendered competitively for the first time, revealing previously below-market rates.",
    sources: ["BlockVoice submitted accounts"],
  },
  {
    component: "Water & Other",
    weight: 0.09,
    color: "#64748b",
    values: { "2021": 100, "2022": 108, "2023": 118, "2024": 125, "2025": 130 },
    explanation: "Water rates, fire safety testing, CCTV, and sundry costs have grown steadily. The biggest outlier is water — some buildings have seen 300%+ increases due to leak detection, communal supply recharging, or billing errors.",
    sources: ["BlockVoice submitted accounts", "Ofwat household bill data"],
  },
];

export const LONDON_ACTUALS_WEIGHTED: Record<string, number> = {
  "2021": 100, "2022": 106, "2023": 140, "2024": 152, "2025": 156,
};

export const ACTUALS_YEARS = ["2021", "2022", "2023", "2024", "2025"];

// ─── London Benchmark Stats ────────────────────────────────────────────────

export const LONDON_BENCHMARKS = {
  avgAnnualCharge: 2801,
  avgMonthly: 233.45,
  yoyGrowth: 6.4,
  fiveYearGrowth: 41.2,
  cpiFiveYearGrowth: 30.9,
  tenYearGrowth: 64.5,
  centralLondonPremium: 67, // % higher than rest of UK
};

// ─── 3. Estate-by-Estate Breakdown ──────────────────────────────────────────

export const ESTATES: EstateData[] = [
  {
    name: "Vista, Chelsea Bridge",
    slug: "vista-chelsea-bridge",
    years: ["2021", "2022", "2023"],
    totalExpenditure: { "2021": 2359083, "2022": 2800000, "2023": 3368291 },
    growthPct: 42.7,
    lineItems: [
      { category: "Buildings Insurance", values: { "2021": 385380, "2022": 550000, "2023": 816907 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Insurance grew +111.9% vs synthetic index of +60%. Request broker market test and check if cladding remediation costs are being passed through premiums." },
      { category: "Utilities (Elec, Water, Comms)", values: { "2021": 201172, "2022": 220000, "2023": 245881 }, indexComparison: "below", shouldChallenge: false },
      { category: "Management Fees", values: { "2021": 169213, "2022": 180000, "2023": 196001 }, indexComparison: "inline", shouldChallenge: false },
      { category: "Direct Staff Costs", values: { "2021": 510552, "2022": 510000, "2023": 510033 }, indexComparison: "below", shouldChallenge: false },
      { category: "Repairs & Maintenance", values: { "2021": 350000, "2022": 450000, "2023": 520000 }, indexComparison: "above", shouldChallenge: true, challengeReason: "R&M costs up +48.6%. Request itemised breakdown of major works vs routine maintenance. Check if Section 20 consultation was followed for works over £250/unit." },
      { category: "Reserve Fund Contributions", values: { "2021": 280000, "2022": 310000, "2023": 350000 }, indexComparison: "inline", shouldChallenge: false },
    ],
  },
  {
    name: "Rivermead Court",
    slug: "rivermead-court",
    years: ["2022", "2023"],
    totalExpenditure: { "2022": 1357624, "2023": 1782251 },
    growthPct: 31.2,
    lineItems: [
      { category: "Building Repairs & Maintenance", values: { "2022": 70095, "2023": 86648 }, indexComparison: "above", shouldChallenge: false },
      { category: "Legal & Professional Fees", values: { "2022": 4620, "2023": 9066 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Legal fees doubled (+96.2%). Request breakdown of what legal matters required this expenditure and whether costs are proportionate." },
      { category: "Boiler R&M", values: { "2022": 56250, "2023": 58452 }, indexComparison: "inline", shouldChallenge: false },
      { category: "Lift Maintenance", values: { "2022": 31308, "2023": 28294 }, indexComparison: "below", shouldChallenge: false },
      { category: "Staff Wages", values: { "2022": 423179, "2023": 413513 }, indexComparison: "below", shouldChallenge: false },
    ],
  },
  {
    name: "Windmill Gate",
    slug: "windmill-gate",
    years: ["2022", "2023"],
    totalExpenditure: { "2022": 180000, "2023": 290000 },
    growthPct: 61.1,
    lineItems: [
      { category: "Utilities & Insurance", values: { "2022": 57730, "2023": 86013 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Combined utilities & insurance up +48.9%. Request separate breakdowns — bundled reporting obscures which component is driving the increase." },
      { category: "Water Communal", values: { "2022": 13113, "2023": 52694 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Water costs up +301.8%. This is exceptionally high — check for leaks, faulty meters, or billing errors. Request meter readings and water company bills." },
      { category: "Gardening", values: { "2022": 18000, "2023": 35407 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Gardening doubled (+96.7%). Was a new contract tendered? Request competing quotes and scope of works comparison." },
      { category: "Electrical Repairs", values: { "2022": 564, "2023": 11547 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Electrical repairs up +1,948%. While one-off repairs explain some variation, this magnitude warrants a full breakdown of works carried out." },
      { category: "Total Contracts/Maintenance", values: { "2022": 50183, "2023": 88596 }, indexComparison: "above", shouldChallenge: true, challengeReason: "Maintenance contracts up +76.5%. Were new contracts competitively tendered? Request contract terms and alternative quotes." },
    ],
  },
  {
    name: "The Parks, Ilford",
    slug: "the-parks",
    years: ["2022", "2023", "2024"],
    totalExpenditure: { "2022": 95000, "2023": 78000, "2024": 72000 },
    growthPct: -24.2,
    lineItems: [
      { category: "Managing Agent Fee", values: { "2022": 18772, "2023": 17275, "2024": 17236 }, indexComparison: "below", shouldChallenge: false },
      { category: "General Repairs (Block)", values: { "2022": 27139, "2023": 9401 }, indexComparison: "below", shouldChallenge: false },
      { category: "Door Entry Systems", values: { "2022": 2998, "2023": 4971 }, indexComparison: "above", shouldChallenge: false },
      { category: "Lift Maintenance", values: { "2023": 5006, "2024": 0 }, indexComparison: "below", shouldChallenge: false },
    ],
  },
];

// ─── 4. Tribunal Adjustments ────────────────────────────────────────────────

export const TRIBUNAL_CASES: TribunalCase[] = [
  {
    building: "104–106 Mackenzie Road, London N7",
    reference: "LON/00AY/LSC/2023",
    demands: [
      { item: "Management Fee", demanded: 2630, adjusted: 1315, note: "Reduced by 50% — tribunal found fee disproportionate to services provided" },
      { item: "Common Electricity", demanded: 1383, adjusted: 360, note: "Reduced by 74% — landlord could not evidence actual consumption or provide meter readings" },
      { item: "Health & Safety Testing", demanded: 724, adjusted: 120, note: "Reduced by 83% — costs included testing not required by regulation for this building type" },
    ],
    summary: "The tribunal found systematic overcharging across multiple service charge heads, with the landlord unable to provide adequate documentation for the amounts demanded. Total reduction of approximately 60% across challenged items.",
  },
  {
    building: "Fairlawn, Hall Place",
    reference: "LON/00BJ/LSC/2022",
    demands: [
      { item: "Management Fees (as billed)", demanded: 19974, adjusted: 365, note: "Management fee contained a hidden £16,418 'warden fee' not disclosed in the lease. Tribunal capped true management at £365 per flat per annum" },
    ],
    summary: "A landmark case exposing how some agents embed undisclosed costs within 'management fees'. The warden service charge was hidden inside the management fee line item, meaning leaseholders were unknowingly paying for a service they hadn't agreed to. The tribunal ruled the true management fee was £365/flat — a 98% reduction from the billed amount.",
  },
  {
    building: "Welford House",
    reference: "LON/00AW/LSC/2023",
    demands: [
      { item: "Residential Unit Annual Charge (2021)", demanded: 1516, adjusted: 1516, note: "2021 charge accepted as reasonable" },
      { item: "Residential Unit Annual Charge (2022)", demanded: 1594, adjusted: 1594, note: "2022 charge accepted — +5.1% increase deemed proportionate" },
      { item: "Residential Unit Budget (2023)", demanded: 1922, adjusted: 1700, note: "2023 budget reduced — +20.5% jump not justified. Agent could not evidence why costs would increase at 4× CPI rate" },
    ],
    summary: "The tribunal accepted modest year-on-year increases (5.1%) but rejected a sudden 20.5% budget increase where the managing agent could not justify the acceleration. This sets an important precedent: agents must evidence why costs are increasing faster than inflation.",
  },
];

// ─── Chart data helpers ────────────────────────────────────────────────────

export function getIndexChartData(index: IndexRow[], weighted: Record<string, number>, years: string[]) {
  return years.map(year => {
    const point: Record<string, number | string> = { year };
    index.forEach(row => { point[row.component] = row.values[year] || 0; });
    point["Weighted Index"] = weighted[year] || 0;
    return point;
  });
}

export function getEstateForSlug(slug: string): EstateData | undefined {
  return ESTATES.find(e => e.slug === slug);
}
