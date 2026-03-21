"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DevData {
  id: string;
  name: string;
  slug: string;
  postcodes: string[];
  total_units: number;
  agentName: string | null;
  agentId: string | null;
  freeholderName: string | null;
  freeholderId: string | null;
  blocks: { id: string; name: string }[];
}

export default function SignUp() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressPicked, setAddressPicked] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [manualMode, setManualMode] = useState(false);

  // Building context from ?building=[slug]
  const [devData, setDevData] = useState<DevData | null>(null);
  const [loadingDev, setLoadingDev] = useState(false);

  // Correction state
  const [correctAgent, setCorrectAgent] = useState(false);
  const [correctFreeholder, setCorrectFreeholder] = useState(false);
  const [agentCorrection, setAgentCorrection] = useState("");
  const [freeholderCorrection, setFreeholderCorrection] = useState("");
  const [propertyManagerInfo, setPropertyManagerInfo] = useState("");

  // Form
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    buildingName: "",  // the block/building name (e.g. "Sophora House")
    developmentName: "", // the parent development (e.g. "Vista, Chelsea Bridge")
    flatNumber: "",
    street: "",
    town: "",
    county: "",
    status: "owner" as string,
    blockId: "",
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const buildingSlug = p.get("building");
    const pc = p.get("postcode") || "";
    if (pc) setPostcode(pc);

    if (buildingSlug) {
      loadDevelopment(buildingSlug);
    }
  }, []);

  async function loadDevelopment(slug: string) {
    setLoadingDev(true);
    try {
      const { data: dev } = await supabase
        .from("developments")
        .select("id, name, slug, postcodes, total_units")
        .eq("slug", slug)
        .single();

      if (!dev) return;

      const { data: linkData } = await supabase
        .from("development_links")
        .select("managing_agent_id, freeholder_id, managing_agents(name), freeholders(name)")
        .eq("development_id", dev.id)
        .single();

      const { data: blockData } = await supabase
        .from("blocks")
        .select("id, name")
        .eq("development_id", dev.id)
        .order("name");

      setDevData({
        id: dev.id,
        name: dev.name,
        slug: dev.slug,
        postcodes: dev.postcodes,
        total_units: dev.total_units,
        agentName: (linkData?.managing_agents as any)?.name || null,
        agentId: linkData?.managing_agent_id || null,
        freeholderName: (linkData?.freeholders as any)?.name || null,
        freeholderId: linkData?.freeholder_id || null,
        blocks: blockData || [],
      });

      if (dev.postcodes?.[0]) setPostcode(dev.postcodes[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDev(false);
    }
  }

  function updateForm(field: string, value: string) {
    setForm({ ...form, [field]: value });
  }

  async function lookupAddress() {
    if (!postcode.trim()) return;
    setSearching(true);
    setError("");
    setAddresses([]);
    setAddressPicked(false);
    try {
      const apiRes = await fetch(
        "/api/lookup?postcode=" + encodeURIComponent(postcode.trim())
      );
      const apiData = await apiRes.json();
      if (apiData.result && apiData.result.length > 0) {
        setAddresses(apiData.result);
      } else {
        setManualMode(true);
      }
    } catch {
      setManualMode(true);
    } finally {
      setSearching(false);
    }
  }

  function selectAddress(idx: number) {
    const addr = addresses[idx];
    const flat = addr.sub_building_name
      ? addr.sub_building_name.replace(/^(flat|apt|apartment|unit)\s*/i, "")
      : "";
    setForm({
      ...form,
      buildingName: addr.building_name || addr.line_2 || addr.line_1 || "",
      flatNumber: flat,
      street: addr.thoroughfare || addr.line_3 || "",
      town: addr.post_town || "",
      county: addr.county || "",
    });
    setAddressPicked(true);
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!form.email.trim() || !form.password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (!devData && !form.buildingName.trim()) {
      setError("Please find your address first.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign up failed");
      const userId = authData.user.id;

      // Link to building (old profiles table for backwards compat)
      let buildingId: string | null = null;

      if (devData) {
        // User came from a building page — use development context
        // Still need a buildings row for the old profiles table
        const cleanedPostcode = (devData.postcodes?.[0] || postcode)
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/^(.+?)(\d[A-Z]{2})$/, "$1 $2");

        const blockName =
          form.blockId && devData.blocks.length > 0
            ? devData.blocks.find((b) => b.id === form.blockId)?.name || devData.name
            : devData.name;

        const { data: existingCheck } = await supabase
          .from("buildings")
          .select("id")
          .eq("postcode", cleanedPostcode)
          .eq("development_name", devData.name);

        if (existingCheck && existingCheck.length > 0) {
          buildingId = existingCheck[0].id;
        } else {
          const { data: newBuilding, error: buildingError } = await supabase
            .from("buildings")
            .insert({
              name: blockName,
              postcode: cleanedPostcode,
              total_flats: devData.total_units,
              development_name: devData.name,
            })
            .select("id")
            .single();
          if (buildingError) throw buildingError;
          buildingId = newBuilding.id;
        }
      } else {
        // Direct signup without building context
        const cleanedPostcode = postcode
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/^(.+?)(\d[A-Z]{2})$/, "$1 $2");

        const { data: existingCheck } = await supabase
          .from("buildings")
          .select("id")
          .eq("postcode", cleanedPostcode)
          .eq("name", form.buildingName.trim());

        if (existingCheck && existingCheck.length > 0) {
          buildingId = existingCheck[0].id;
        } else {
          // Determine development name
          const devName = form.developmentName && form.developmentName !== "__no__" && form.developmentName !== "__ask__"
            ? form.developmentName.trim()
            : null;

          const { data: newBuilding, error: buildingError } = await supabase
            .from("buildings")
            .insert({
              name: form.buildingName.trim(),
              postcode: cleanedPostcode,
              total_flats: addresses.length || 50,
              development_name: devName || null,
            })
            .select("id")
            .single();
          if (buildingError) throw buildingError;
          buildingId = newBuilding.id;
        }
      }

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        building_id: buildingId,
        flat_number: form.flatNumber,
        status: form.status || "owner",
      });
      if (profileError) throw profileError;

      // Store corrections if any
      if (devData) {
        if (correctAgent && agentCorrection.trim()) {
          await supabase.from("corrections").insert({
            development_id: devData.id,
            submitted_by: userId,
            field: "managing_agent",
            current_value: devData.agentName || "",
            suggested_value: agentCorrection.trim(),
          });
        }
        if (correctFreeholder && freeholderCorrection.trim()) {
          await supabase.from("corrections").insert({
            development_id: devData.id,
            submitted_by: userId,
            field: "freeholder",
            current_value: devData.freeholderName || "",
            suggested_value: freeholderCorrection.trim(),
          });
        }
        if (propertyManagerInfo.trim()) {
          await supabase.from("corrections").insert({
            development_id: devData.id,
            submitted_by: userId,
            field: "property_manager_contact",
            current_value: "",
            suggested_value: propertyManagerInfo.trim(),
          });
        }
      }

      // Send welcome email (fire-and-forget — don't block signup)
      fetch("/api/email/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {}); // silently ignore email failures

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  const showForm = devData || addressPicked;

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-[#1ec6a4] font-bold text-xl mb-4 block">
            BlockVoice
          </Link>
          {devData ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">
                Join {devData.name}
              </h1>
              <p className="text-[rgba(255,255,255,0.55)] text-sm">
                Confirm your details and join your neighbours
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">
                Create your account
              </h1>
              <p className="text-[rgba(255,255,255,0.55)] text-sm">
                Quick and easy — takes less than a minute.
              </p>
            </>
          )}
        </div>

        {loadingDev && (
          <p className="text-[rgba(255,255,255,0.55)] text-center">Loading building details…</p>
        )}

        {error && (
          <div className="bg-red-900/60 text-red-200 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => updateForm("firstName", e.target.value)}
                className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => updateForm("lastName", e.target.value)}
                className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Email & Password */}
          <div>
            <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
              className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Building context — pre-filled from slug */}
          {devData ? (
            <>
              <div className="bg-[#132847] rounded-xl p-4 border border-[#1e3a5f]">
                <p className="text-xs text-[rgba(255,255,255,0.3)] uppercase tracking-wide font-bold mb-1">
                  Development
                </p>
                <p className="text-white font-bold">{devData.name}</p>
                <p className="text-xs text-[rgba(255,255,255,0.3)] mt-0.5">
                  {devData.postcodes?.[0]} · {devData.total_units} units
                </p>
              </div>

              {/* Block selector */}
              {devData.blocks.length > 0 && (
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                    Block
                  </label>
                  <select
                    value={form.blockId}
                    onChange={(e) => updateForm("blockId", e.target.value)}
                    className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Select your block…</option>
                    {devData.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Flat number */}
              <div>
                <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                  Flat / Apartment Number (optional)
                </label>
                <input
                  type="text"
                  value={form.flatNumber}
                  onChange={(e) => updateForm("flatNumber", e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
                />
              </div>

              {/* Help us keep this accurate */}
              <div className="bg-[#132847] rounded-xl p-4 border border-[#1e3a5f] space-y-4">
                <p className="text-xs text-[rgba(255,255,255,0.3)] uppercase tracking-wide font-bold">
                  Help us keep this accurate
                </p>

                {/* Managing agent */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[rgba(255,255,255,0.3)]">Managing Agent</p>
                      <p className="text-white text-sm font-semibold">
                        {devData.agentName || "Unknown"}
                      </p>
                    </div>
                    <button
                      onClick={() => setCorrectAgent(!correctAgent)}
                      className="text-xs text-[#1ec6a4] hover:underline"
                    >
                      {correctAgent ? "Cancel" : "Correct this"}
                    </button>
                  </div>
                  {correctAgent && (
                    <input
                      type="text"
                      value={agentCorrection}
                      onChange={(e) => setAgentCorrection(e.target.value)}
                      placeholder="Enter the correct managing agent name"
                      className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm mt-2"
                    />
                  )}
                </div>

                {/* Freeholder */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[rgba(255,255,255,0.3)]">Freeholder</p>
                      <p className="text-white text-sm font-semibold">
                        {devData.freeholderName || "Unknown"}
                      </p>
                    </div>
                    <button
                      onClick={() => setCorrectFreeholder(!correctFreeholder)}
                      className="text-xs text-[#1ec6a4] hover:underline"
                    >
                      {correctFreeholder ? "Cancel" : "Correct this"}
                    </button>
                  </div>
                  {correctFreeholder && (
                    <input
                      type="text"
                      value={freeholderCorrection}
                      onChange={(e) => setFreeholderCorrection(e.target.value)}
                      placeholder="Enter the correct freeholder name"
                      className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm mt-2"
                    />
                  )}
                </div>

                {/* Property manager contact */}
                <div>
                  <label className="block text-xs text-[rgba(255,255,255,0.3)] mb-1">
                    Do you have a property manager name or direct email?
                  </label>
                  <input
                    type="text"
                    value={propertyManagerInfo}
                    onChange={(e) => setPropertyManagerInfo(e.target.value)}
                    placeholder="e.g. John Smith, john@example.com"
                    className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                  />
                  <p className="text-xs text-[rgba(255,255,255,0.2)] mt-1">
                    Optional — helps other residents contact the right person
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Postcode lookup — no building context */}
              <div>
                <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                  Postcode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => {
                      setPostcode(e.target.value);
                      setAddressPicked(false);
                      setAddresses([]);
                    }}
                    placeholder="e.g. SW8 4NR"
                    className="flex-1 bg-[#162d50] rounded-lg px-4 py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={lookupAddress}
                    disabled={searching}
                    className="bg-[#1ec6a4] hover:bg-[#25d4b0] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {searching ? "Searching..." : "Find Address"}
                  </button>
                </div>
              </div>

              {/* Address dropdown */}
              {addresses.length > 0 && !addressPicked && (
                <div>
                  <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                    Select your apartment
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value !== "")
                        selectAddress(parseInt(e.target.value));
                    }}
                    className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Pick your address...</option>
                    {addresses.map((a, i) => (
                      <option key={i} value={i}>
                        {[
                          a.sub_building_name,
                          a.building_name,
                          a.building_number,
                          a.thoroughfare,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual address fallback */}
              {manualMode && !addressPicked && (
                <div className="bg-[#162d50] rounded-xl p-4 border border-amber-900/40 space-y-3">
                  <p className="text-xs text-amber-400">
                    Could not look up this postcode automatically. Please enter your address manually.
                  </p>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Flat / Apartment Number</label>
                    <input type="text" value={form.flatNumber}
                      onChange={(e) => updateForm("flatNumber", e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Block Name *</label>
                    <input type="text" value={form.buildingName}
                      onChange={(e) => updateForm("buildingName", e.target.value)}
                      placeholder="e.g. Sophora House, Kings Court"
                      className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white text-sm" />
                    <p className="text-xs text-[rgba(255,255,255,0.3)] mt-1">The specific building you live in.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Street</label>
                    <input type="text" value={form.street}
                      onChange={(e) => updateForm("street", e.target.value)}
                      placeholder="e.g. Queenstown Road"
                      className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Town / City</label>
                      <input type="text" value={form.town}
                        onChange={(e) => updateForm("town", e.target.value)}
                        placeholder="e.g. London"
                        className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Postcode</label>
                      <input type="text" value={postcode} disabled
                        className="w-full bg-[#0f1f3d] border border-[#1e3a5f] rounded-lg px-4 py-2 text-[rgba(255,255,255,0.5)] text-sm" />
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { if (form.buildingName.trim()) setAddressPicked(true); }}
                    className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-2 rounded-lg text-sm font-semibold">
                    Continue
                  </button>
                </div>
              )}

              {/* Address picked — show full structured address */}
              {addressPicked && (
                <>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                      Flat / Apartment Number
                    </label>
                    <input
                      type="text"
                      value={form.flatNumber}
                      onChange={(e) => updateForm("flatNumber", e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                      Block Name
                    </label>
                    <input
                      type="text"
                      value={form.buildingName}
                      onChange={(e) => updateForm("buildingName", e.target.value)}
                      placeholder="e.g. Sophora House, Kings Court"
                      className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                    />
                    <p className="text-xs text-[rgba(255,255,255,0.3)] mt-1">
                      The specific building you live in.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                      Street
                    </label>
                    <input
                      type="text"
                      value={form.street}
                      onChange={(e) => updateForm("street", e.target.value)}
                      className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                        Town / City
                      </label>
                      <input
                        type="text"
                        value={form.town}
                        onChange={(e) => updateForm("town", e.target.value)}
                        className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={postcode}
                        disabled
                        className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-[rgba(255,255,255,0.5)] text-sm"
                      />
                    </div>
                  </div>

                  {/* Development/Estate — ask user since we don't have context */}
                  {(
                    <div className="bg-[#0f1f3d] rounded-xl p-4 border border-[#1e3a5f] space-y-3">
                      <label className="block text-sm text-[rgba(255,255,255,0.55)]">
                        Is your block part of a larger development or estate?
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => updateForm("developmentName", "__ask__")}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.developmentName && form.developmentName !== "__no__" ? "bg-[#1ec6a4] text-white" : "bg-[#162d50] text-[rgba(255,255,255,0.55)] hover:bg-[#1e3a5f]"}`}>
                          Yes
                        </button>
                        <button type="button" onClick={() => updateForm("developmentName", "__no__")}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.developmentName === "__no__" ? "bg-[#1ec6a4] text-white" : "bg-[#162d50] text-[rgba(255,255,255,0.55)] hover:bg-[#1e3a5f]"}`}>
                          No, just one building
                        </button>
                      </div>
                      {form.developmentName === "__ask__" && (
                        <div>
                          <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1 mt-2">
                            Development / Estate Name
                          </label>
                          <input
                            type="text"
                            value=""
                            onChange={(e) => updateForm("developmentName", e.target.value || "__ask__")}
                            placeholder="e.g. Vista, Battersea Power Station"
                            className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white text-sm"
                          />
                          <p className="text-xs text-[rgba(255,255,255,0.3)] mt-1">
                            This helps us group residents across different blocks.
                          </p>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Owner vs Tenant */}
                  <div>
                    <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
                      Are you an owner or tenant?
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => updateForm("status", "owner")}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.status === "owner" ? "bg-[#1ec6a4] text-white" : "bg-[#162d50] text-[rgba(255,255,255,0.55)] hover:bg-[#1e3a5f]"}`}>
                        Owner
                      </button>
                      <button type="button" onClick={() => updateForm("status", "tenant")}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.status === "tenant" ? "bg-[#1ec6a4] text-white" : "bg-[#162d50] text-[rgba(255,255,255,0.55)] hover:bg-[#1e3a5f]"}`}>
                        Tenant
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[rgba(255,255,255,0.3)]">
                    Auto-filled from your address. Edit if anything looks wrong.
                  </p>
                </>
              )}
            </>
          )}

          {/* Submit */}
          {showForm && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#1ec6a4] hover:bg-[#25d4b0] text-white py-3 rounded-lg font-semibold text-lg disabled:opacity-50"
            >
              {loading
                ? "Creating account..."
                : devData
                  ? "Confirm & Join My Building"
                  : "Sign Up — It's Free"}
            </button>
          )}

          {/* Sign in link */}
          <p className="text-center text-sm text-[rgba(255,255,255,0.3)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1ec6a4] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
