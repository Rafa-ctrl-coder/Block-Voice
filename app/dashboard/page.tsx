"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

interface Building {
  id: string;
  name: string;
  postcode: string;
  total_flats: number;
  managing_agent: string;
}

interface Issue {
  id: string;
  title: string;
  upvotes: number;
  created_at: string;
}

interface Profile {
  first_name: string;
  is_verified: boolean;
  building_id: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [building, setBuilding] = useState<Building | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [residentCount, setResidentCount] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData) {
        router.push("/signup");
        return;
      }

      setProfile(profileData);

      const { data: buildingData } = await supabase
        .from("buildings")
        .select("*")
        .eq("id", profileData.building_id)
        .single();

      if (buildingData) setBuilding(buildingData);

      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("building_id", profileData.building_id);

      setResidentCount(count || 0);

      const { data: issuesData } = await supabase
        .from("issues")
        .select("*")
        .eq("building_id", profileData.building_id)
        .order("upvotes", { ascending: false });

      if (issuesData) setIssues(issuesData);

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-xl">Loading your dashboard...</p>
      </div>
    );
  }

  const progress = building
    ? Math.round((residentCount / building.total_flats) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-orange-400">BlockVoice</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Hi, {profile?.first_name}
            {profile?.is_verified && (
              <span className="ml-2 bg-green-800 text-green-200 text-xs px-2 py-1 rounded">
                Verified
              </span>
            )}
            {!profile?.is_verified && (
              <span className="ml-2 bg-yellow-800 text-yellow-200 text-xs px-2 py-1 rounded">
                Pending Verification
              </span>
            )}
          </span>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white"
          >
            Log Out
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-3xl font-bold mb-2">{building?.name}</h2>
        <p className="text-gray-400 mb-8">
          {building?.postcode} — Managed by{" "}
          <span className="text-orange-400">
            {building?.managing_agent || "Unknown"}
          </span>
        </p>

        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-3">Building Sign-Up Progress</h3>
          <div className="w-full bg-gray-700 rounded-full h-6 mb-2">
            <div
              className="bg-orange-500 h-6 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ width: `${Math.max(progress, 8)}%` }}
            >
              {progress}%
            </div>
          </div>
          <p className="text-gray-400">
            <span className="text-white font-semibold">{residentCount}</span> out
            of{" "}
            <span className="text-white font-semibold">
              {building?.total_flats}
            </span>{" "}
            flats have joined!
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Top Issues in Your Building
          </h3>
          {issues.length === 0 ? (
            <p className="text-gray-400">
              No issues reported yet. Be the first!
            </p>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-4 bg-gray-700 rounded-lg p-4"
                >
                  <span className="text-2xl font-bold text-orange-400">
                    #{index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{issue.title}</p>
                  </div>
                  <span className="text-gray-400 text-sm">
                    👍 {issue.upvotes}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}