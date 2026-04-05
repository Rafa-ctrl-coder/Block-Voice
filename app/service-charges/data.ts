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
    component: "Utilities",
    weight: 0.15,
    color: "#ef4444",
    values: { "2021": 100, "2022": 180, "2023": 250, "2024": 175, "2025": 160, "2026": 165 },
    explanation: "The 2022–23 energy crisis saw commercial gas and electricity prices surge 80–150% as wholesale markets spiked following the Russia-Ukraine conflict. Fixed-rate contracts rolled off into peak pricing throughout 2023. By 2024, wholesale prices fell significantly but remain elevated vs pre-crisis levels. Buildings on variable tariffs saw the sharpest increases; those on longer fixed deals experienced delayed but steep renewals.",
    sources: ["Ofgem price cap data", "Cornwall Insight wholesale forecasts", "BEIS energy statistics"],
  },
  {
    component: "Insurance",
    weight: 0.25,
    color: "#f59e0b",
    values: { "2021": 100, "2022": 130, "2023": 160, "2024": 170, "2025": 178, "2026": 185 },
    explanation: "Buildings insurance premiums have risen relentlessly since 2021, driven by the post-Grenfell cladding crisis, reinsurance capacity withdrawal from UK residential, and rising reinstatement cost estimates. Insurers are pricing in fire safety remediation uncertainty, EWS1 survey requirements, and higher rebuild costs due to construction inflation. Many new-build developments have seen premiums double or triple, with some becoming effectively uninsurable on the open market.",
    sources: ["ABI buildings insurance data", "FCA General Insurance report 2024", "RICS Reinstatement Cost Assessment guidance"],
  },
  {
    component: "Staff Costs",
    weight: 0.30,
    color: "#3b82f6",
    values: { "2021": 100, "2022": 107, "2023": 117, "2024": 128, "2025": 137, "2026": 142 },
    explanation: "Concierge, cleaning, and security staff costs track closely with the National Living Wage (NLW), which has risen from £8.91 (2021) to £12.21 (2025) — a 37% increase. Employer NICs increased in April 2025, adding further pressure. Many buildings also face staff retention challenges, leading to agency premium costs. The 2026 estimate assumes a further NLW increase to ~£12.50 and continued NIC pressure.",
    sources: ["Gov.uk National Living Wage announcements", "ONS Average Weekly Earnings", "HMRC employer NIC rates"],
  },
  {
    component: "Management Fees",
    weight: 0.30,
    color: "#8b5cf6",
    values: { "2021": 100, "2022": 109, "2023": 117, "2024": 121, "2025": 124, "2026": 127 },
    explanation: "Managing agent fees typically include RPI or CPI-linked annual increases written into management contracts. Growth has tracked slightly above CPI due to consolidation in the property management sector (fewer large agents = less competitive pressure), regulatory burden from the Building Safety Act, and increased compliance requirements. Some agents have also introduced supplementary charges for fire safety administration and building safety case management.",
    sources: ["ONS CPI data", "ARMA/IRPM industry reports", "Building Safety Act 2022 compliance guidance"],
  },
];

export const SYNTHETIC_WEIGHTED: Record<string, number> = {
  "2021": 100, "2022": 116, "2023": 135, "2024": 141, "2025": 146, "2026": 151,
};

export const SYNTHETIC_YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

// ─── 2. London Actuals Index ────────────────────────────────────────────────

export const LONDON_ACTUALS_INDEX: IndexRow[] = [
  {
    component: "Utilities",
    weight: 0.15,
    color: "#ef4444",
    values: { "2021": 100, "2022": 105, "2023": 145, "2024": 150, "2025": 140 },
    explanation: "Actual utility costs lagged the wholesale market due to fixed-rate contracts. Many buildings only saw the full impact in 2023 when contracts renewed at peak rates. The 2024 'catch-up' billing reflects deficit recovery from underfunded 2022 budgets. 2025 shows modest relief as new contracts lock in lower (but still elevated) rates.",
    sources: ["BlockVoice submitted accounts", "London shared accounts analysis"],
  },
  {
    component: "Insurance",
    weight: 0.25,
    color: "#f59e0b",
    values: { "2021": 100, "2022": 115, "2023": 210, "2024": 225, "2025": 240 },
    explanation: "Insurance is the single biggest driver of actual service charge increases. The 'contract lag' hid the true impact until 2023, when many buildings saw premiums more than double on renewal. The gap between our synthetic index (178) and actuals (240) in 2025 reflects the severity of the London high-rise insurance crisis — far worse than macro models predicted. New-build developments with cladding concerns are the hardest hit.",
    sources: ["BlockVoice submitted accounts", "London Fire Brigade building data", "Leaseholder insurance complaints to FCA"],
  },
  {
    component: "Staff Costs",
    weight: 0.30,
    color: "#3b82f6",
    values: { "2021": 100, "2022": 100, "2023": 105, "2024": 115, "2025": 125 },
    explanation: "Staff costs in actual accounts show a delayed response — many buildings held wages flat in 2022 but then faced catch-up increases in 2023–24 as retention became difficult. Agency and overtime costs have increased faster than base wages. Some buildings have switched from in-house to outsourced concierge, creating one-off cost jumps.",
    sources: ["BlockVoice submitted accounts", "London Living Wage Foundation data"],
  },
  {
    component: "Management Fees",
    weight: 0.30,
    color: "#8b5cf6",
    values: { "2021": 100, "2022": 105, "2023": 120, "2024": 150, "2025": 135 },
    explanation: "Management fees spiked in 2024 as agents passed through Building Safety Act compliance costs and fire safety administration charges. The 2025 reduction in some buildings reflects residents challenging these supplementary fees at tribunal or through RTM (Right to Manage) processes. The gap between synthetic (124) and actuals (135) in 2025 suggests agents are pricing above inflation.",
    sources: ["BlockVoice submitted accounts", "First-tier Tribunal decisions", "LEASE (advisory service) case data"],
  },
];

export const LONDON_ACTUALS_WEIGHTED: Record<string, number> = {
  "2021": 100, "2022": 106, "2023": 143, "2024": 155, "2025": 158,
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
