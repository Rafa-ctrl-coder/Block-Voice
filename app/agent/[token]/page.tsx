"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Issue {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  supporters: number;
  existingResponse?: string;
}

interface PortalData {
  agentName: string;
  developmentName: string;
  issues: Issue[];
  expired?: boolean;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "— No change —" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved (closes the issue)" },
];

export default function AgentPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/agent-portal?token=${token}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ agentName: "", developmentName: "", issues: [], error: "Failed to load" }))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitResponse(issueId: string) {
    const text = responses[issueId]?.trim();
    if (!text) return;
    setSubmitting(issueId);
    try {
      const r = await fetch("/api/agent-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          issueId,
          response: text,
          newStatus: statuses[issueId] || null,
        }),
      });
      if (r.ok) {
        setSubmitted(prev => new Set(prev).add(issueId));
        setResponses(prev => ({ ...prev, [issueId]: "" }));
        setStatuses(prev => ({ ...prev, [issueId]: "" }));
      }
    } catch { /* ignore */ }
    finally { setSubmitting(null); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--navy)" }}>
      <p style={{ color: "var(--t2)" }}>Loading portal...</p>
    </div>
  );

  if (data?.error || data?.expired) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--navy)" }}>
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-3">
          {data?.expired ? "Link expired" : "Something went wrong"}
        </h1>
        <p style={{ color: "var(--t2)" }}>
          {data?.expired
            ? "This portal link has expired. Please contact BlockVoice for a new one."
            : "We couldn't load the portal. The link may be invalid."}
        </p>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--navy)" }}>
      <nav className="flex items-center justify-between px-[6%] h-14"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="font-extrabold text-[17px]" style={{ color: "var(--teal)" }}>BlockVoice</span>
        <span className="text-xs px-3 py-1 rounded-full font-semibold"
          style={{ background: "rgba(30,198,164,0.12)", color: "var(--teal)", border: "1px solid rgba(30,198,164,0.25)" }}>
          Agent Portal
        </span>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Issues at {data.developmentName}
          </h1>
          <p className="text-sm" style={{ color: "var(--t2)" }}>
            Responding as <strong className="text-white">{data.agentName}</strong> · Residents can see your responses
          </p>
        </div>

        {data.issues.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
            <p className="text-lg font-semibold text-white mb-2">No open issues</p>
            <p style={{ color: "var(--t2)" }}>There are currently no issues reported by residents.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.issues.map(issue => {
              const cat = issue.category.charAt(0).toUpperCase() + issue.category.slice(1);
              const hasResponse = issue.existingResponse || submitted.has(issue.id);
              const date = new Date(issue.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

              return (
                <div key={issue.id} className="rounded-xl p-5"
                  style={{ background: "var(--navy-card)", border: "1px solid var(--navy-card-b)" }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-white text-[15px]">{issue.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(30,198,164,0.12)", color: "var(--teal)", border: "1px solid rgba(30,198,164,0.25)" }}>
                          {cat}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--t3)" }}>{date}</span>
                        <span className="text-[11px]" style={{ color: "var(--t3)" }}>
                          · {issue.supporters} supporter{issue.supporters !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {hasResponse && (
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
                        Responded
                      </span>
                    )}
                  </div>

                  <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--t2)" }}>
                    {issue.description}
                  </p>

                  {issue.existingResponse && (
                    <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(30,198,164,0.06)", border: "1px solid rgba(30,198,164,0.15)" }}>
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--teal)" }}>Your response</p>
                      <p className="text-[13px]" style={{ color: "var(--t2)" }}>{issue.existingResponse}</p>
                    </div>
                  )}

                  {submitted.has(issue.id) && !issue.existingResponse && (
                    <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                      <p className="text-[13px] font-semibold" style={{ color: "#4ade80" }}>Response submitted — residents will see it on their dashboard.</p>
                    </div>
                  )}

                  {!hasResponse && (
                    <div>
                      <textarea
                        value={responses[issue.id] || ""}
                        onChange={e => setResponses(prev => ({ ...prev, [issue.id]: e.target.value }))}
                        placeholder="Write your response to this issue..."
                        rows={3}
                        className="w-full rounded-lg px-3 py-2.5 text-[13px] text-white resize-none outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <label className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "var(--t3)" }}>
                          Update status
                        </label>
                        <select
                          value={statuses[issue.id] || ""}
                          onChange={e => setStatuses(prev => ({ ...prev, [issue.id]: e.target.value }))}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value} style={{ background: "#0f1f3d" }}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => submitResponse(issue.id)}
                          disabled={!responses[issue.id]?.trim() || submitting === issue.id}
                          className="ml-auto font-bold text-[13px] px-5 py-2 rounded-lg text-white disabled:opacity-40"
                          style={{ background: "var(--teal)" }}>
                          {submitting === issue.id ? "Submitting..." : "Submit Response"}
                        </button>
                      </div>
                      {statuses[issue.id] === "resolved" && (
                        <p className="mt-2 text-[11px]" style={{ color: "#fbbf24" }}>
                          ⚠ Marking as resolved will close this issue for residents.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 pt-6 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--t3)" }}>
            Powered by <span className="font-bold" style={{ color: "var(--teal)" }}>BlockVoice</span> · Helping residents and agents communicate better
          </p>
        </div>
      </div>
    </div>
  );
}
