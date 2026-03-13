"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    buildingName: "",
    postcode: "",
    flatNumber: "",
    totalFlats: "26-50",
    status: "owner",
    managingAgent: "",
    topIssue: "",
  });

  function updateForm(field: string, value: string) {
    setForm({ ...form, [field]: value });
  }

  function getRangeMax(range: string): number {
    switch (range) {
      case "1-10": return 10;
      case "11-25": return 25;
      case "26-50": return 50;
      case "51-100": return 100;
      case "100+": return 150;
      default: return 50;
    }
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign up failed");

      const userId = authData.user.id;

      let verificationUrl = "";
      if (file) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/verification.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("verifications")
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        verificationUrl = filePath;
      }

      const { data: existingBuildings } = await supabase
        .from("buildings")
        .select("id")
        .eq("postcode", form.postcode.toUpperCase())
        .eq("name", form.buildingName);

      let buildingId: string;

      if (existingBuildings && existingBuildings.length > 0) {
        buildingId = existingBuildings[0].id;
      } else {
        const { data: newBuilding, error: buildingError } = await supabase
          .from("buildings")
          .insert({
            name: form.buildingName,
            postcode: form.postcode.toUpperCase(),
            managing_agent: form.managingAgent,
            total_flats: getRangeMax(form.totalFlats),
          })
          .select("id")
          .single();

        if (buildingError) throw buildingError;
        buildingId = newBuilding.id;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        building_id: buildingId,
        flat_number: form.flatNumber,
        status: form.status,
        top_issue: form.topIssue,
        verification_url: verificationUrl,
      });

      if (profileError) throw profileError;

      if (form.topIssue) {
        await supabase.from("issues").insert({
          building_id: buildingId,
          profile_id: userId,
          title: form.topIssue,
        });
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-12 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">
          Join BlockVoice
        </h1>
        <p className="text-gray-400 mb-8">
          Sign up to connect with your building.
        </p>

        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => updateForm("firstName", e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => updateForm("lastName", e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Building Name
            </label>
            <input
              type="text"
              value={form.buildingName}
              onChange={(e) => updateForm("buildingName", e.target.value)}
              placeholder="e.g. Maple Court"
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Postcode
              </label>
              <input
                type="text"
                value={form.postcode}
                onChange={(e) => updateForm("postcode", e.target.value)}
                placeholder="e.g. SW1A 1AA"
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Flat Number
              </label>
              <input
                type="text"
                value={form.flatNumber}
                onChange={(e) => updateForm("flatNumber", e.target.value)}
                placeholder="e.g. 12"
                className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              How many flats in your building?
            </label>
            <select
              value={form.totalFlats}
              onChange={(e) => updateForm("totalFlats", e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            >
              <option value="1-10">1 - 10 flats</option>
              <option value="11-25">11 - 25 flats</option>
              <option value="26-50">26 - 50 flats</option>
              <option value="51-100">51 - 100 flats</option>
              <option value="100+">100+ flats</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Are you an owner or tenant?
            </label>
            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            >
              <option value="owner">Owner</option>
              <option value="tenant">Tenant</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Managing Agent Name
            </label>
            <input
              type="text"
              value={form.managingAgent}
              onChange={(e) => updateForm("managingAgent", e.target.value)}
              placeholder="e.g. FirstPort"
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Your #1 Issue in the Building
            </label>
            <input
              type="text"
              value={form.topIssue}
              onChange={(e) => updateForm("topIssue", e.target.value)}
              placeholder="e.g. Service charge too high"
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Upload Verification (utility bill photo)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                if (e.target.files) setFile(e.target.files[0]);
              }}
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold text-lg disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}