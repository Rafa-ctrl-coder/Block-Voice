"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export default function VerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<VerificationStatus>("unverified");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .single();

    setStatus((profile?.verification_status as VerificationStatus) || "unverified");
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setError("Please upload a PDF, JPG, or PNG file.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("verifications")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update profile status
      await supabase
        .from("profiles")
        .update({
          verification_status: "pending",
          verification_url: filePath,
        })
        .eq("id", userId);

      setStatus("pending");
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex items-center justify-center">
        <p className="text-[rgba(255,255,255,0.55)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white">
      <nav className="flex justify-between items-center px-6 md:px-8 py-3.5 border-b border-[#1e3a5f]" style={{ background: "#0f1f3d" }}>
        <Link href="/dashboard" className="text-lg font-extrabold text-[#1ec6a4]">BlockVoice</Link>
        <Link href="/dashboard" className="text-xs text-[rgba(255,255,255,0.55)] hover:text-white">← Back to dashboard</Link>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-2xl font-extrabold text-white mb-2">Verify Your Identity</h1>
        <p className="text-sm text-[rgba(255,255,255,0.55)] mb-8">
          Verified residents carry more weight when raising issues and rating their managing agent.
        </p>

        {/* Verified */}
        {status === "verified" && (
          <div className="bg-[#132847] rounded-xl p-6 border border-green-900/40 text-center">
            <span className="text-4xl block mb-3">✅</span>
            <h2 className="text-lg font-bold text-green-400 mb-2">Your identity is verified</h2>
            <p className="text-sm text-[rgba(255,255,255,0.55)]">
              Your account has been verified. This badge is visible on your profile.
            </p>
          </div>
        )}

        {/* Pending */}
        {status === "pending" && (
          <div className="bg-[#132847] rounded-xl p-6 border border-amber-900/40 text-center">
            <span className="text-4xl block mb-3">⏳</span>
            <h2 className="text-lg font-bold text-amber-400 mb-2">We&apos;re reviewing your document</h2>
            <p className="text-sm text-[rgba(255,255,255,0.55)]">
              This usually takes 1–2 working days. We&apos;ll update your account once verified.
            </p>
          </div>
        )}

        {/* Unverified or Rejected */}
        {(status === "unverified" || status === "rejected") && (
          <div className="bg-[#132847] rounded-xl p-6 border border-[#1e3a5f]">
            {status === "rejected" && (
              <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-400">
                  Your previous document couldn&apos;t be verified. Please try again with a clearer document.
                </p>
              </div>
            )}

            <h2 className="text-base font-bold text-white mb-3">Upload a document proving your address</h2>
            <p className="text-xs text-[rgba(255,255,255,0.55)] mb-4">
              We accept any of the following:
            </p>
            <ul className="text-xs text-[rgba(255,255,255,0.45)] space-y-1.5 mb-6">
              <li className="flex gap-2"><span>📄</span> Council tax bill</li>
              <li className="flex gap-2"><span>💡</span> Utility bill (gas, electric, water)</li>
              <li className="flex gap-2"><span>📋</span> Tenancy agreement</li>
              <li className="flex gap-2"><span>🏠</span> Mortgage statement</li>
            </ul>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            {success && <p className="text-sm text-green-400 mb-3">Document uploaded successfully!</p>}

            <label className="block w-full cursor-pointer">
              <div className="border-2 border-dashed border-[#1e3a5f] hover:border-[#1ec6a4]/40 rounded-xl p-8 text-center transition-colors">
                <span className="text-2xl block mb-2">📎</span>
                <p className="text-sm text-[rgba(255,255,255,0.55)] mb-1">
                  {uploading ? "Uploading..." : "Click to upload your document"}
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.3)]">PDF, JPG, or PNG · Max 10MB</p>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm text-[#1ec6a4] hover:underline">
            ← Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
