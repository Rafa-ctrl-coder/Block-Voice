"use client";
import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { IndexRow, EstateData, TribunalCase, getIndexChartData, LONDON_BENCHMARKS } from "./data";

const tooltipStyle = { background: "#0f1f3d", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 12 };
const axisProps = { tick: { fill: "rgba(255,255,255,0.4)", fontSize: 11 }, axisLine: false, tickLine: false };
const yAxisProps = { tick: { fill: "rgba(255,255,255,0.3)", fontSize: 10 }, axisLine: false, tickLine: false };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl p-5 ${className}`} style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase font-bold tracking-[1.5px] mb-3" style={{ color: "var(--teal)" }}>{children}</p>;
}

// ─── Section 1: Synthetic Market Index ───────────────────────────────────────

export function SyntheticIndexSection({ index, weighted, years }: { index: IndexRow[]; weighted: Record<string, number>; years: string[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const chartData = getIndexChartData(index, weighted, years);

  return (
    <section className="px-[6%] py-12">
      <SectionLabel>Synthetic Market Index</SectionLabel>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Expected cost growth based on market data</h2>
      <p className="text-[13px] leading-relaxed mb-8 max-w-[600px]" style={{ color: "var(--t2)" }}>
        This index tracks how service charge components <em>should</em> be growing based on energy markets, insurance capacity, wages, and inflation. Base year 2021 = 100.
      </p>

      <Card className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...yAxisProps} domain={[80, 280]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
            {index.map(row => (
              <Line key={row.component} type="monotone" dataKey={row.component} stroke={row.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
            <Line type="monotone" dataKey="Weighted Index" stroke="#1ec6a4" strokeWidth={3} dot={{ r: 4, fill: "#1ec6a4" }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="space-y-2">
        {index.map(row => {
          const latest = row.values[years[years.length - 1]];
          const growth = latest - 100;
          return (
            <div key={row.component} className="rounded-lg overflow-hidden" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <button onClick={() => setExpanded(expanded === row.component ? null : row.component)}
                className="w-full flex items-center justify-between px-4 py-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: row.color }} />
                  <span className="text-[14px] font-semibold text-white">{row.component}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--t2)" }}>
                    Weight: {(row.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[14px] font-bold ${growth > 50 ? "text-red-400" : growth > 20 ? "text-amber-400" : "text-green-400"}`}>
                    +{growth.toFixed(0)}%
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--t3)" }}>{expanded === row.component ? "▲" : "▼"}</span>
                </div>
              </button>
              {expanded === row.component && (
                <div className="px-4 pb-4">
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--t2)" }}>{row.explanation}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.sources.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--t3)" }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section 2: London Actuals Index ─────────────────────────────────────────

export function LondonActualsSection({ index, weighted, years, syntheticWeighted }: { index: IndexRow[]; weighted: Record<string, number>; years: string[]; syntheticWeighted: Record<string, number> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const chartData = years.map(year => ({
    year,
    ...Object.fromEntries(index.map(r => [r.component, r.values[year] || 0])),
    "Actuals Index": weighted[year] || 0,
    "Synthetic Index": syntheticWeighted[year] || 0,
  }));

  return (
    <section className="px-[6%] py-12" style={{ background: "var(--navy-mid)" }}>
      <SectionLabel>London Actuals Index</SectionLabel>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">What leaseholders are actually paying</h2>
      <p className="text-[13px] leading-relaxed mb-8 max-w-[600px]" style={{ color: "var(--t2)" }}>
        Based on real service charge accounts submitted by residents and publicly available data. Shows the &quot;contract lag&quot; in 2022 followed by aggressive catch-up billing.
      </p>

      <Card className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...yAxisProps} domain={[80, 260]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
            {index.map(row => (
              <Line key={row.component} type="monotone" dataKey={row.component} stroke={row.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
            <Line type="monotone" dataKey="Actuals Index" stroke="#1ec6a4" strokeWidth={3} dot={{ r: 4, fill: "#1ec6a4" }} />
            <Line type="monotone" dataKey="Synthetic Index" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Benchmark cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Avg London annual charge", value: `£${LONDON_BENCHMARKS.avgAnnualCharge.toLocaleString()}`, sub: `£${LONDON_BENCHMARKS.avgMonthly}/month` },
          { label: "Year-on-year growth", value: `+${LONDON_BENCHMARKS.yoyGrowth}%`, sub: "2024 → 2025" },
          { label: "5-year growth", value: `+${LONDON_BENCHMARKS.fiveYearGrowth}%`, sub: `vs CPI +${LONDON_BENCHMARKS.cpiFiveYearGrowth}%`, alert: true },
          { label: "10-year growth", value: `+${LONDON_BENCHMARKS.tenYearGrowth}%`, sub: "2015 → 2025" },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-[10px] uppercase font-semibold mb-2" style={{ color: "var(--t3)" }}>{s.label}</p>
            <p className={`text-xl font-extrabold ${s.alert ? "text-red-400" : "text-white"}`}>{s.value}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--t3)" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* SC vs CPI gap */}
      <Card>
        <p className="text-[13px] font-semibold text-white mb-3">Service charges are outpacing inflation</p>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--t2)" }}>Service charge growth (5yr)</span><span className="text-red-400 font-bold">+{LONDON_BENCHMARKS.fiveYearGrowth}%</span></div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full bg-red-400" style={{ width: `${(LONDON_BENCHMARKS.fiveYearGrowth / 50) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--t2)" }}>CPI inflation (5yr)</span><span className="text-white font-bold">+{LONDON_BENCHMARKS.cpiFiveYearGrowth}%</span></div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${(LONDON_BENCHMARKS.cpiFiveYearGrowth / 50) * 100}%`, background: "var(--teal)" }} />
            </div>
          </div>
          <p className="text-[12px] mt-2" style={{ color: "var(--t2)" }}>
            London service charges have grown <strong className="text-red-400">{(LONDON_BENCHMARKS.fiveYearGrowth - LONDON_BENCHMARKS.cpiFiveYearGrowth).toFixed(1)} percentage points</strong> faster than CPI over the last 5 years.
          </p>
        </div>
      </Card>

      {/* Expandable component explanations */}
      <div className="space-y-2 mt-6">
        {index.map(row => {
          const synVal = syntheticWeighted[years[years.length - 1]] || 0;
          const actVal = row.values[years[years.length - 1]] || 0;
          const gap = actVal - (syntheticWeighted[years[years.length - 1]] || 0);
          return (
            <div key={row.component} className="rounded-lg overflow-hidden" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
              <button onClick={() => setExpanded(expanded === row.component ? null : row.component)}
                className="w-full flex items-center justify-between px-4 py-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: row.color }} />
                  <span className="text-[14px] font-semibold text-white">{row.component}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px]" style={{ color: "var(--t2)" }}>Actual: {actVal}</span>
                  <span className="text-[11px]" style={{ color: "var(--t3)" }}>{expanded === row.component ? "▲" : "▼"}</span>
                </div>
              </button>
              {expanded === row.component && (
                <div className="px-4 pb-4">
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--t2)" }}>{row.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section 3: Estate Breakdown ─────────────────────────────────────────────

export function EstateBreakdownSection({ estates }: { estates: EstateData[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const estate = estates[activeTab];

  const chartData = estate.years.map(year => {
    const point: Record<string, string | number> = { year };
    estate.lineItems.forEach(li => { point[li.category] = li.values[year] || 0; });
    return point;
  });

  const colors = ["#1ec6a4", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <section className="px-[6%] py-12">
      <SectionLabel>Estate-by-Estate Analysis</SectionLabel>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">How individual buildings compare</h2>
      <p className="text-[13px] leading-relaxed mb-6 max-w-[600px]" style={{ color: "var(--t2)" }}>
        Drill into real service charge accounts to see which line items are driving costs — and whether you should challenge them.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {estates.map((e, i) => (
          <button key={e.slug} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors ${i === activeTab ? "text-white" : ""}`}
            style={{ background: i === activeTab ? "var(--teal)" : "var(--navy-card)", color: i === activeTab ? "#0f1f3d" : "var(--t2)", border: `1px solid ${i === activeTab ? "var(--teal)" : "var(--navy-card-b)"}` }}>
            {e.name}
          </button>
        ))}
      </div>

      {/* Header */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{estate.name}</h3>
            <p className="text-[12px]" style={{ color: "var(--t2)" }}>
              Total expenditure: £{(estate.totalExpenditure[estate.years[0]] || 0).toLocaleString()} → £{(estate.totalExpenditure[estate.years[estate.years.length - 1]] || 0).toLocaleString()}
            </p>
          </div>
          <div className={`text-2xl font-extrabold ${estate.growthPct > 30 ? "text-red-400" : estate.growthPct > 10 ? "text-amber-400" : "text-green-400"}`}>
            {estate.growthPct > 0 ? "+" : ""}{estate.growthPct}%
          </div>
        </div>
      </Card>

      {/* Stacked bar chart */}
      <Card className="mb-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `£${Number(v).toLocaleString()}`} />
            {estate.lineItems.map((li, i) => (
              <Bar key={li.category} dataKey={li.category} stackId="a" fill={colors[i % colors.length]} radius={i === estate.lineItems.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Line items table */}
      <div className="space-y-2">
        {estate.lineItems.map(li => {
          const vals = Object.values(li.values).filter(Boolean);
          const first = vals[0];
          const last = vals[vals.length - 1];
          const growth = first > 0 ? ((last - first) / first * 100) : 0;
          const indicatorColor = li.indexComparison === "above" ? "#ef4444" : li.indexComparison === "below" ? "#4ade80" : "#fbbf24";

          return (
            <Card key={li.category}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: indicatorColor }} />
                    <span className="text-[14px] font-semibold text-white">{li.category}</span>
                    {li.shouldChallenge && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>Challenge</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-[12px]" style={{ color: "var(--t2)" }}>
                    {Object.entries(li.values).map(([yr, val]) => (
                      <span key={yr}>{yr}: £{val.toLocaleString()}</span>
                    ))}
                  </div>
                  {li.shouldChallenge && li.challengeReason && (
                    <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "rgba(239,68,68,0.8)" }}>{li.challengeReason}</p>
                  )}
                </div>
                <span className={`text-[14px] font-bold flex-shrink-0 ${growth > 30 ? "text-red-400" : growth > 10 ? "text-amber-400" : growth < 0 ? "text-green-400" : "text-white"}`}>
                  {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section 4: Tribunal Adjustments ─────────────────────────────────────────

export function TribunalAdjustmentsSection({ cases }: { cases: TribunalCase[] }) {
  return (
    <section className="px-[6%] py-12" style={{ background: "var(--navy-mid)" }}>
      <SectionLabel>Tribunal Outcomes</SectionLabel>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">When residents challenge — and win</h2>
      <p className="text-[13px] leading-relaxed mb-8 max-w-[600px]" style={{ color: "var(--t2)" }}>
        Real First-tier Tribunal (Property Chamber) decisions showing what managing agents demanded versus what the tribunal allowed. Residents can and do successfully challenge unreasonable charges.
      </p>

      <div className="space-y-4">
        {cases.map(c => (
          <Card key={c.building}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-bold text-white">{c.building}</h3>
                {c.reference && <p className="text-[11px]" style={{ color: "var(--t3)" }}>Ref: {c.reference}</p>}
              </div>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 font-semibold" style={{ color: "var(--t2)" }}>Item</th>
                    <th className="text-right py-2 font-semibold" style={{ color: "var(--t2)" }}>Demanded</th>
                    <th className="text-right py-2 font-semibold" style={{ color: "var(--t2)" }}>Adjusted</th>
                    <th className="text-right py-2 font-semibold" style={{ color: "var(--teal)" }}>Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {c.demands.map(d => {
                    const saved = d.demanded - d.adjusted;
                    const pct = d.demanded > 0 ? (saved / d.demanded * 100) : 0;
                    return (
                      <tr key={d.item} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="py-2 text-white">{d.item}</td>
                        <td className="py-2 text-right text-red-400">£{d.demanded.toLocaleString()}</td>
                        <td className="py-2 text-right text-white">£{d.adjusted.toLocaleString()}</td>
                        <td className="py-2 text-right font-bold" style={{ color: "var(--teal)" }}>
                          {saved > 0 ? `−£${saved.toLocaleString()} (${pct.toFixed(0)}%)` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[12px] leading-relaxed" style={{ color: "var(--t2)" }}>{c.summary}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
