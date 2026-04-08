"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Types mirrored from the API routes — kept local to avoid coupling to DB types
// -----------------------------------------------------------------------------
interface DocTypeDef {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  icon: string | null;
}

interface CommunityDocument {
  id: string;
  profile_id: string;
  doc_type: string;
  original_filename: string;
  status: "analysing" | "ready" | "failed";
  analysis_error: string | null;
  personal_analysis: Record<string, unknown> | null;
  community_summary: Record<string, unknown> | null;
  is_shared: boolean;
  shared_at: string | null;
  champion_handle: string | null;
  document_date: string | null;
  created_at: string;
}

interface ProgressRow {
  doc_type: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  shared_count: number;
}

interface FeedResponse {
  developmentName: string | null;
  types: DocTypeDef[];
  ownDocuments: CommunityDocument[];
  feed: CommunityDocument[];
  progress: ProgressRow[];
}

interface Props {
  profileId: string;
  buildingId: string;
  developmentName: string;
  firstName: string;
}

// -----------------------------------------------------------------------------
// Styling helpers — all using CSS custom properties from globals.css
// -----------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  background: "var(--navy-card)",
  border: "1px solid var(--navy-card-b)",
};

export default function CommunityDocumentsSection({
  profileId,
  buildingId,
  developmentName,
  firstName,
}: Props) {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("service_charge");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<CommunityDocument | null>(null);
  const [sharing, setSharing] = useState(false);
  const [dismissedReviews, setDismissedReviews] = useState<Set<string>>(new Set());
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const r = await fetch(`/api/community-documents?profile_id=${profileId}`);
      if (!r.ok) throw new Error("Failed to load");
      const json = (await r.json()) as FeedResponse;
      setData(json);

      // If a just-ready document needs review, surface it (unless dismissed)
      const justReady = json.ownDocuments.find(
        (d) => d.status === "ready" && !d.is_shared && !dismissedReviews.has(d.id)
      );
      if (justReady) {
        setReviewingDoc(justReady);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId, dismissedReviews]);

  // Initial load
  useEffect(() => {
    loadData();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadData]);

  // Poll while any document is still analysing
  useEffect(() => {
    if (!data) return;
    const hasAnalysing = data.ownDocuments.some((d) => d.status === "analysing");
    if (hasAnalysing) {
      pollTimerRef.current = setTimeout(() => loadData(), 3000);
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [data, loadData]);

  // ---- Upload handler ----
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Max 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setUploadError("Unsupported file type. Please upload a PDF, PNG, or JPG.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", selectedDocType);
      form.append("profile_id", profileId);
      form.append("building_id", buildingId);

      const r = await fetch("/api/community-documents/upload", {
        method: "POST",
        body: form,
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${r.status})`);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---- Share / dismiss handlers ----
  async function handleShare(docId: string) {
    setSharing(true);
    try {
      const r = await fetch(`/api/community-documents/${docId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, share: true }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Share failed");
      }
      setReviewingDoc(null);
      setDismissedReviews((prev) => new Set(prev).add(docId));
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setSharing(false);
    }
  }

  function handleKeepPrivate(docId: string) {
    setDismissedReviews((prev) => new Set(prev).add(docId));
    setReviewingDoc(null);
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      await fetch(`/api/community-documents/${docId}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      });
      setDismissedReviews((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px]" style={{ color: "var(--t2)" }}>
          Loading your community documents…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px]" style={{ color: "var(--t2)" }}>
          Unable to load documents. Please refresh.
        </p>
      </div>
    );
  }

  const { types, ownDocuments, feed, progress } = data;
  const filteredFeed = filterType ? feed.filter((f) => f.doc_type === filterType) : feed;

  const isEmpty = ownDocuments.length === 0;

  return (
    <div className="py-2">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <p className="text-[10px] uppercase font-semibold tracking-[1.2px] mb-1" style={{ color: "var(--teal)" }}>
          Community champions
        </p>
        <h2 className="text-[20px] font-bold text-white mb-1">Your building, shared and understood</h2>
        <p className="text-[13px] leading-relaxed max-w-[640px]" style={{ color: "var(--t2)" }}>
          Upload any building document and BlockVoice analyses it for you.
          Choose to share a redacted summary with your neighbours — your original
          stays private and you stay anonymous as &quot;Resident A&quot;.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* UPLOAD BAR */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl p-4 mb-5" style={cardStyle}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full">
            <label className="block text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>
              Upload a document
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="rounded-lg px-3 py-2 text-[13px] text-white outline-none w-full sm:w-auto"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {types.map((t) => (
                  <option key={t.id} value={t.id} style={{ background: "#0f1f3d" }}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={handleFileSelect}
                disabled={uploading}
                className="text-[12px] text-white flex-1"
                style={{ color: "var(--t2)" }}
              />
            </div>
          </div>
        </div>
        {uploading && (
          <p className="text-[12px] mt-3" style={{ color: "var(--teal)" }}>
            Uploading… Gemini will analyse your document in about 20 seconds.
          </p>
        )}
        {uploadError && (
          <p className="text-[12px] mt-3 text-red-400">{uploadError}</p>
        )}
        <p className="text-[11px] mt-2" style={{ color: "var(--t3)" }}>
          PDF, PNG, or JPG. Max 10MB. 10 uploads per day.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* REVIEW MODAL — surfaces when a just-analysed doc is waiting */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {reviewingDoc && (
        <ReviewPanel
          doc={reviewingDoc}
          types={types}
          firstName={firstName}
          sharing={sharing}
          onShare={() => handleShare(reviewingDoc.id)}
          onKeepPrivate={() => handleKeepPrivate(reviewingDoc.id)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* EMPTY STATE */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {isEmpty && feed.length === 0 && (
        <div className="rounded-xl p-6 text-center mb-5" style={cardStyle}>
          <div className="text-3xl mb-2">🏠</div>
          <p className="text-[15px] font-bold text-white mb-1">Be the first champion at {developmentName}</p>
          <p className="text-[12px] max-w-[460px] mx-auto" style={{ color: "var(--t2)" }}>
            Upload a service charge, lease, or any other building document above.
            You&apos;ll get a personalised breakdown, and your neighbours will thank you
            for building the shared knowledge base.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PROGRESS TRACKER */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="mb-5">
        <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>
          Progress at {developmentName}
        </p>
        <div className="flex flex-wrap gap-2">
          {progress.map((p) => {
            const active = filterType === p.doc_type;
            const shared = p.shared_count > 0;
            return (
              <button
                key={p.doc_type}
                onClick={() => setFilterType(active ? null : p.doc_type)}
                className="text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors"
                style={{
                  background: active
                    ? "rgba(30,198,164,0.2)"
                    : shared
                    ? "rgba(30,198,164,0.08)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    active
                      ? "var(--teal)"
                      : shared
                      ? "rgba(30,198,164,0.3)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                  color: shared ? "var(--teal)" : "var(--t3)",
                }}>
                {p.label} {shared ? `· ${p.shared_count}` : "· not yet shared"}
              </button>
            );
          })}
        </div>
        {filterType && (
          <button
            onClick={() => setFilterType(null)}
            className="text-[11px] mt-2"
            style={{ color: "var(--t3)" }}>
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TWO-COLUMN LAYOUT: My documents + Community feed */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* LEFT: My documents */}
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>
            My documents
          </p>
          {ownDocuments.length === 0 ? (
            <div className="rounded-xl p-4" style={cardStyle}>
              <p className="text-[12px]" style={{ color: "var(--t3)" }}>
                You haven&apos;t uploaded anything yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ownDocuments.map((d) => {
                const type = types.find((t) => t.id === d.doc_type);
                return (
                  <div
                    key={d.id}
                    className="rounded-xl p-3"
                    style={cardStyle}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[12px] font-semibold text-white truncate flex-1">
                        {type?.label || d.doc_type}
                      </p>
                      <StatusPill doc={d} />
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "var(--t3)" }}>
                      {d.original_filename}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px]" style={{ color: "var(--t3)" }}>
                        {new Date(d.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        {d.status === "ready" && !d.is_shared && (
                          <button
                            onClick={() => {
                              setReviewingDoc(d);
                              setDismissedReviews((prev) => {
                                const next = new Set(prev);
                                next.delete(d.id);
                                return next;
                              });
                            }}
                            className="text-[10px] font-semibold"
                            style={{ color: "var(--teal)" }}>
                            Review
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-[10px]"
                          style={{ color: "var(--t3)" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                    {d.analysis_error && (
                      <p className="text-[10px] mt-1 text-red-400">{d.analysis_error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Community feed */}
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--t3)" }}>
            Your building community
          </p>
          {filteredFeed.length === 0 ? (
            <div className="rounded-xl p-4" style={cardStyle}>
              <p className="text-[12px]" style={{ color: "var(--t3)" }}>
                {filterType
                  ? "No documents of this type have been shared yet. Be the first!"
                  : "No documents have been shared at your development yet. Be the first community champion!"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFeed.map((d) => {
                const type = types.find((t) => t.id === d.doc_type);
                const expanded = expandedFeedId === d.id;
                return (
                  <div
                    key={d.id}
                    className="rounded-xl p-4 cursor-pointer transition-colors"
                    style={cardStyle}
                    onClick={() => setExpandedFeedId(expanded ? null : d.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-white">
                            {type?.label || d.doc_type}
                          </p>
                          <span
                            className="text-[9px] font-bold uppercase px-2 py-[2px] rounded-full"
                            style={{
                              background: "rgba(30,198,164,0.15)",
                              color: "var(--teal)",
                              border: "1px solid rgba(30,198,164,0.3)",
                            }}>
                            Champion
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--t2)" }}>
                          Shared by <strong className="text-white">{d.champion_handle || "a resident"}</strong>
                          {d.shared_at && ` · ${new Date(d.shared_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--t3)" }}>
                        {expanded ? "−" : "+"}
                      </span>
                    </div>
                    {expanded && d.community_summary && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--navy-card-b)" }}>
                        <SummaryRenderer data={d.community_summary} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Status pill
// -----------------------------------------------------------------------------
function StatusPill({ doc }: { doc: CommunityDocument }) {
  if (doc.status === "analysing") {
    return (
      <span className="text-[9px] font-bold uppercase px-2 py-[2px] rounded-full flex-shrink-0"
        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
        Analysing
      </span>
    );
  }
  if (doc.status === "failed") {
    return (
      <span className="text-[9px] font-bold uppercase px-2 py-[2px] rounded-full flex-shrink-0"
        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
        Failed
      </span>
    );
  }
  if (doc.is_shared) {
    return (
      <span className="text-[9px] font-bold uppercase px-2 py-[2px] rounded-full flex-shrink-0"
        style={{ background: "rgba(30,198,164,0.15)", color: "var(--teal)", border: "1px solid rgba(30,198,164,0.3)" }}>
        Shared
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold uppercase px-2 py-[2px] rounded-full flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.06)", color: "var(--t3)", border: "1px solid rgba(255,255,255,0.1)" }}>
      Private
    </span>
  );
}

// -----------------------------------------------------------------------------
// Review panel — shown when a newly-ready document is waiting for share decision
// -----------------------------------------------------------------------------
function ReviewPanel({
  doc,
  types,
  firstName,
  sharing,
  onShare,
  onKeepPrivate,
}: {
  doc: CommunityDocument;
  types: DocTypeDef[];
  firstName: string;
  sharing: boolean;
  onShare: () => void;
  onKeepPrivate: () => void;
}) {
  const type = types.find((t) => t.id === doc.doc_type);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="rounded-xl p-5 mb-5" style={{
      background: "linear-gradient(135deg, rgba(30,198,164,0.12) 0%, rgba(30,198,164,0.02) 100%)",
      border: "1px solid rgba(30,198,164,0.3)",
    }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--teal)" }}>
          Ready for review
        </span>
      </div>
      <h3 className="text-[16px] font-bold text-white mb-1">
        Your {type?.label.toLowerCase() || "document"} is analysed, {firstName}
      </h3>
      <p className="text-[12px] mb-4" style={{ color: "var(--t2)" }}>
        Here&apos;s your personalised breakdown. Only you can see this.
      </p>

      {/* Personal analysis */}
      {doc.personal_analysis && (
        <div className="rounded-lg p-4 mb-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--navy-card-b)" }}>
          <p className="text-[9px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--teal)" }}>
            Your personal breakdown
          </p>
          <SummaryRenderer data={doc.personal_analysis} />
        </div>
      )}

      {/* Share prompt */}
      <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--navy-card-b)" }}>
        <p className="text-[13px] font-semibold text-white mb-2">
          Share with your building community?
        </p>
        <p className="text-[12px] mb-3" style={{ color: "var(--t2)" }}>
          Only a redacted structured summary is shared with other residents — <strong className="text-white">no names, flat numbers, or personal details</strong>.
          Your original stays private. You&apos;ll appear as <strong className="text-white">Resident A</strong> (or your existing champion handle if you&apos;ve shared before).
        </p>

        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-[11px] mb-3"
          style={{ color: "var(--teal)" }}>
          {showPreview ? "− Hide" : "+ Preview"} what residents will see
        </button>
        {showPreview && doc.community_summary && (
          <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--navy-card-b)" }}>
            <SummaryRenderer data={doc.community_summary} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onShare}
            disabled={sharing}
            className="font-bold text-[13px] px-5 py-2.5 rounded-lg text-[#0f1f3d] disabled:opacity-50"
            style={{ background: "var(--teal)" }}>
            {sharing ? "Sharing…" : "✓ Share with my building"}
          </button>
          <button
            onClick={onKeepPrivate}
            disabled={sharing}
            className="font-semibold text-[13px] px-5 py-2.5 rounded-lg disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.15)", color: "var(--t2)" }}>
            Keep private
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Generic summary renderer — handles the JSON shape from personal_analysis and
// community_summary. Renders nested arrays/objects as readable rows.
// -----------------------------------------------------------------------------
function SummaryRenderer({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) {
    return <p className="text-[11px]" style={{ color: "var(--t3)" }}>No details available.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="text-[9px] uppercase font-semibold tracking-wider mb-0.5" style={{ color: "var(--t3)" }}>
            {humanize(key)}
          </div>
          <div className="text-[12px]" style={{ color: "var(--t1)" }}>
            {renderValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span style={{ color: "var(--t3)" }}>—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "var(--t3)" }}>—</span>;
    return (
      <ul className="list-disc pl-5 space-y-0.5">
        {value.map((item, i) => (
          <li key={i}>{renderValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <div className="space-y-1 pl-3" style={{ borderLeft: "2px solid var(--navy-card-b)" }}>
        {Object.entries(obj).map(([k, v]) => (
          <div key={k}>
            <span className="text-[10px]" style={{ color: "var(--t3)" }}>{humanize(k)}: </span>
            <span>{renderValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return String(value);
}
