"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IssueCategory, IssueStatus } from "../lib/database.types";

const CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "service_charge", label: "Service Charge" },
  { value: "safety", label: "Safety" },
  { value: "security", label: "Security" },
  { value: "facilities", label: "Facilities" },
  { value: "communal_areas", label: "Communal Areas" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

const CATEGORY_EMOJI: Record<string, string> = {
  facilities: "🏢",
  maintenance: "🔧",
  service_charge: "💷",
  security: "🔒",
  safety: "⚠️",
  communal_areas: "🏠",
  communication: "📢",
  other: "📋",
};

const STATUS_STYLES: Record<IssueStatus, string> = {
  new: "bg-indigo-900/60 text-indigo-300",
  acknowledged: "bg-amber-900/60 text-amber-400",
  in_progress: "bg-blue-900/60 text-blue-300",
  resolved: "bg-green-900/60 text-green-400",
  escalated: "bg-red-900/60 text-red-400",
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  escalated: "Escalated",
};

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  status: IssueStatus;
  created_at: string;
  raised_by: string;
  raiser_name: string | null;
  support_count: number;
  user_supported: boolean;
  evidence: { id: string; file_url: string; file_type: string; caption: string | null }[];
}

interface BlockOption {
  id: string;
  name: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // Development context
  const [devId, setDevId] = useState("");
  const [devName, setDevName] = useState("");
  const [devSlug, setDevSlug] = useState("");
  const [totalUnits, setTotalUnits] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [blocks, setBlocks] = useState<BlockOption[]>([]);

  // Issues
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // New issue form
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    category: "maintenance" as IssueCategory,
    blockId: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // Get user's building → development
      const { data: profile } = await supabase
        .from("profiles")
        .select("building_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      const { data: building } = await supabase
        .from("buildings")
        .select("name, total_flats, development_name")
        .eq("id", profile.building_id)
        .single();

      if (!building) return;

      // Resolve development from building's development_name
      const devNameValue = building.development_name || building.name;
      let developmentId = "";
      let developmentSlug = "";
      let developmentTotalUnits = building.total_flats || 0;

      const { data: dev } = await supabase
        .from("developments")
        .select("id, name, slug, total_units")
        .eq("name", devNameValue)
        .single();

      if (dev) {
        developmentId = dev.id;
        developmentSlug = dev.slug;
        developmentTotalUnits = dev.total_units;
        setDevName(dev.name);
      } else {
        // Fallback: try slug match or use building name
        setDevName(devNameValue);
      }

      setDevId(developmentId);
      setDevSlug(developmentSlug);
      setTotalUnits(developmentTotalUnits);

      // Member count (profiles at same building or development)
      if (building.development_name) {
        const { data: devBuildings } = await supabase
          .from("buildings")
          .select("id")
          .eq("development_name", building.development_name);
        if (devBuildings) {
          const ids = devBuildings.map((b) => b.id);
          const { data: members } = await supabase
            .from("profiles")
            .select("id")
            .in("building_id", ids);
          if (members) setMemberCount(members.length);
        }
      } else {
        const { data: members } = await supabase
          .from("profiles")
          .select("id")
          .eq("building_id", profile.building_id);
        if (members) setMemberCount(members.length);
      }

      // Blocks
      if (developmentId) {
        const { data: blockData } = await supabase
          .from("blocks")
          .select("id, name")
          .eq("development_id", developmentId)
          .order("name");
        if (blockData) setBlocks(blockData);
      }

      // Load issues
      if (developmentId) {
        await loadIssues(developmentId, user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadIssues(developmentId: string, currentUserId: string) {
    const { data: issueData } = await supabase
      .from("issues")
      .select("id, title, description, category, status, created_at, raised_by")
      .eq("development_id", developmentId)
      .order("created_at", { ascending: false });

    if (!issueData) return;

    const withDetails = await Promise.all(
      issueData.map(async (issue) => {
        // Supporter count
        const { count: sc } = await supabase
          .from("issue_supporters")
          .select("*", { count: "exact", head: true })
          .eq("issue_id", issue.id);

        // Did current user support?
        const { data: userSup } = await supabase
          .from("issue_supporters")
          .select("id")
          .eq("issue_id", issue.id)
          .eq("user_id", currentUserId);

        // Raiser name
        const { data: raiserProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", issue.raised_by)
          .single();

        // Evidence
        const { data: evidenceData } = await supabase
          .from("issue_evidence")
          .select("id, file_url, file_type, caption")
          .eq("issue_id", issue.id);

        return {
          ...issue,
          support_count: (sc || 0) + 1, // +1 for raiser
          user_supported: !!(userSup && userSup.length > 0),
          raiser_name: raiserProfile
            ? `${raiserProfile.first_name} ${raiserProfile.last_name}`
            : null,
          evidence: evidenceData || [],
        } as IssueRow;
      })
    );

    setIssues(withDetails);
  }

  async function handleSubmitIssue() {
    if (!newIssue.title.trim() || !devId) return;
    setSubmitting(true);

    try {
      const { data: created, error: issueError } = await supabase
        .from("issues")
        .insert({
          development_id: devId,
          block_id: newIssue.blockId || null,
          raised_by: userId,
          title: newIssue.title.trim(),
          description: newIssue.description.trim() || null,
          category: newIssue.category,
        })
        .select("id")
        .single();

      if (issueError) throw issueError;

      // Upload evidence
      if (created && photos.length > 0) {
        for (const photo of photos) {
          const fileExt = photo.name.split(".").pop();
          const filePath = `${devId}/${created.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("issue-photos")
            .upload(filePath, photo);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("issue-photos")
              .getPublicUrl(filePath);

            await supabase.from("issue_evidence").insert({
              issue_id: created.id,
              uploaded_by: userId,
              file_url: urlData.publicUrl,
              file_type: photo.type.startsWith("image/") ? "image" : "document",
            });
          }
        }
      }

      setNewIssue({ title: "", description: "", category: "maintenance", blockId: "" });
      setPhotos([]);
      setShowForm(false);
      await loadIssues(devId, userId);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleSupport(issueId: string, currentlySupported: boolean) {
    try {
      if (currentlySupported) {
        await supabase
          .from("issue_supporters")
          .delete()
          .eq("issue_id", issueId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("issue_supporters")
          .insert({ issue_id: issueId, user_id: userId });
      }
      await loadIssues(devId, userId);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  // Filter issues
  const filtered = issues.filter((issue) => {
    if (filterCategory && issue.category !== filterCategory) return false;
    if (filterStatus && issue.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading your building...</p>
      </div>
    );
  }

  const pct = totalUnits > 0 ? Math.round((memberCount / totalUnits) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
        <Link href="/" className="text-xl font-bold text-orange-400">
          BlockVoice
        </Link>
        <div className="flex items-center gap-4">
          {devSlug && (
            <Link
              href={`/buildings/${devSlug}`}
              className="text-sm text-gray-400 hover:text-white"
            >
              {devName}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-white"
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Building summary */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">{devName}</h2>
            <span className="text-sm text-gray-400">
              {memberCount} of ~{totalUnits} residents joined
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-orange-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {pct}% of your building is on BlockVoice
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            {showForm ? "Cancel" : "Raise an Issue"}
          </button>
          <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm font-semibold">
            Invite Neighbours
          </button>
        </div>

        {/* New issue form */}
        {showForm && (
          <div className="bg-gray-900 rounded-xl p-6 mb-6 space-y-3">
            <input
              type="text"
              placeholder="Issue title (e.g. Broken lift)"
              value={newIssue.title}
              onChange={(e) =>
                setNewIssue({ ...newIssue, title: e.target.value })
              }
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm"
            />

            <select
              value={newIssue.category}
              onChange={(e) =>
                setNewIssue({
                  ...newIssue,
                  category: e.target.value as IssueCategory,
                })
              }
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Describe the issue in detail..."
              value={newIssue.description}
              onChange={(e) =>
                setNewIssue({ ...newIssue, description: e.target.value })
              }
              rows={3}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm resize-none"
            />

            {blocks.length > 0 && (
              <select
                value={newIssue.blockId}
                onChange={(e) =>
                  setNewIssue({ ...newIssue, blockId: e.target.value })
                }
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm"
              >
                <option value="">Whole development</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <div>
              <label className="text-xs text-gray-400">
                Upload evidence (optional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files) setPhotos(Array.from(e.target.files));
                }}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm mt-1"
              />
            </div>

            <button
              onClick={handleSubmitIssue}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Issue"}
            </button>
          </div>
        )}

        {/* Filters */}
        {issues.length > 0 && (
          <div className="flex gap-2 mb-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-800 rounded-lg px-3 py-1.5 text-white text-xs"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 rounded-lg px-3 py-1.5 text-white text-xs"
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
        )}

        {/* Issues list */}
        <h2 className="text-xl font-bold mb-4">Building Issues</h2>

        {filtered.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-2">
              {issues.length === 0
                ? "No issues reported yet."
                : "No issues match your filters."}
            </p>
            {issues.length === 0 && (
              <p className="text-sm text-gray-500">
                Be the first to report an issue in your building!
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <div
                key={issue.id}
                className="bg-gray-900 rounded-xl p-5"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-white">
                      <span className="mr-1.5">
                        {CATEGORY_EMOJI[issue.category] || "📋"}
                      </span>
                      {issue.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                        {CATEGORIES.find((c) => c.value === issue.category)
                          ?.label || issue.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[issue.status]}`}
                      >
                        {STATUS_LABELS[issue.status]}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400 font-semibold whitespace-nowrap">
                    {issue.support_count}{" "}
                    {issue.support_count === 1 ? "resident" : "residents"}
                  </span>
                </div>

                {issue.description && (
                  <p className="text-sm text-gray-400 mb-2">
                    {issue.description}
                  </p>
                )}

                {/* Evidence */}
                {issue.evidence.length > 0 && (
                  <div className="flex gap-2 mb-2 overflow-x-auto">
                    {issue.evidence.map((ev) =>
                      ev.file_type === "image" ? (
                        <img
                          key={ev.id}
                          src={ev.file_url}
                          alt={ev.caption || "Evidence"}
                          className="rounded-lg max-h-32 object-cover"
                        />
                      ) : (
                        <a
                          key={ev.id}
                          href={ev.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:underline bg-gray-800 px-3 py-2 rounded-lg"
                        >
                          📄 {ev.caption || "Document"}
                        </a>
                      )
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                  <span>
                    Reported by {issue.raiser_name || "A resident"}
                  </span>
                  <span>
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() =>
                    toggleSupport(issue.id, issue.user_supported)
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    issue.user_supported
                      ? "bg-green-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {issue.user_supported
                    ? "You supported this"
                    : "I have this problem too"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Documents placeholder */}
        <div className="bg-gray-900 rounded-xl p-6 mt-8 text-center border border-dashed border-gray-700">
          <p className="text-gray-500 text-sm">
            Coming soon — upload and share service charge statements, insurance
            certificates, and building documents
          </p>
        </div>
      </div>
    </div>
  );
}
