"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Candidate {
  slug: string;
  name: string;
  totalUnits: number;
}

interface Address {
  line_1: string;
  line_2: string;
  building_name: string;
  sub_building_name: string;
  thoroughfare: string;
  post_town: string;
}

export default function Home() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // address picker state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddresses, setShowAddresses] = useState(false);
  const [matching, setMatching] = useState(false);

  // result state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [noMatch, setNoMatch] = useState(false);

  function reset() {
    setAddresses([]);
    setShowAddresses(false);
    setCandidates([]);
    setNoMatch(false);
    setError("");
  }

  async function handleSearch() {
    if (!postcode.trim()) return;
    setSearching(true);
    reset();

    try {
      // Step 1: fetch addresses from Ideal Postcodes
      const lookupRes = await fetch(
        "/api/lookup?postcode=" + encodeURIComponent(postcode.trim())
      );
      const lookupData = await lookupRes.json();

      if (lookupData.result && lookupData.result.length > 0) {
        setAddresses(lookupData.result);
        setShowAddresses(true);
      } else {
        // No addresses from API — try postcode match directly
        await matchPostcode();
      }
    } catch {
      setError("Could not look up this postcode. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function matchPostcode() {
    const res = await fetch(
      "/api/check-building?postcode=" + encodeURIComponent(postcode.trim())
    );
    const data = await res.json();

    if (data.matched && data.slug) {
      router.push("/buildings/" + data.slug);
    } else if (data.candidates && data.candidates.length > 0) {
      setCandidates(data.candidates);
    } else {
      setNoMatch(true);
    }
  }

  async function selectAddress(idx: number) {
    const addr = addresses[idx];
    const fullAddress = [
      addr.sub_building_name,
      addr.building_name,
      addr.thoroughfare,
      addr.post_town,
    ]
      .filter(Boolean)
      .join(", ");

    setShowAddresses(false);
    setMatching(true);

    try {
      const res = await fetch(
        "/api/check-building?postcode=" +
          encodeURIComponent(postcode.trim()) +
          "&address=" +
          encodeURIComponent(fullAddress)
      );
      const data = await res.json();

      if (data.matched && data.slug) {
        router.push("/buildings/" + data.slug);
      } else if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
      } else {
        setNoMatch(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6">
        <h1 className="text-2xl font-bold text-orange-400">BlockVoice</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-gray-300 hover:text-white px-4 py-2 font-semibold"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Join Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-lg text-orange-400 mb-4 font-semibold">
          Helping residents take back control
        </p>
        <h2 className="text-4xl md:text-5xl font-bold mb-6 max-w-2xl leading-tight">
          Your building. Your voice. Your power.
        </h2>
        <p className="text-lg text-gray-400 mb-10 max-w-xl">
          Find out who manages your building, what issues residents are raising,
          and take action.
        </p>

        {/* Search */}
        <div className="w-full max-w-md">
          <p className="text-sm text-gray-400 mb-2">
            Enter your postcode to find your building
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={postcode}
              onChange={(e) => {
                setPostcode(e.target.value);
                reset();
              }}
              placeholder="e.g. SW11 8BW"
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

          {/* Address dropdown */}
          {showAddresses && addresses.length > 0 && (
            <div className="mt-4 text-left">
              <label className="block text-sm text-gray-400 mb-1">
                Select your address
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value !== "") selectAddress(parseInt(e.target.value));
                }}
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white"
                defaultValue=""
              >
                <option value="">Pick your address...</option>
                {addresses.map((a, i) => (
                  <option key={i} value={i}>
                    {[a.sub_building_name, a.building_name, a.thoroughfare]
                      .filter(Boolean)
                      .join(", ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Matching spinner */}
          {matching && (
            <p className="text-gray-400 text-sm mt-4">
              Finding your building...
            </p>
          )}

          {/* Disambiguation — multiple candidates */}
          {candidates.length > 0 && (
            <div className="mt-6 space-y-3 text-left">
              <p className="text-sm text-gray-400 mb-2">
                We found these buildings near you — which is yours?
              </p>
              {candidates.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => router.push("/buildings/" + c.slug)}
                  className="w-full bg-gray-900 hover:bg-gray-800 rounded-xl p-4 border border-gray-800 text-left transition-colors"
                >
                  <h3 className="font-bold text-white">{c.name}</h3>
                  <span className="text-xs text-gray-500">
                    {c.totalUnits} units
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  setCandidates([]);
                  setNoMatch(true);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-300 py-2"
              >
                None of these — my building isn&apos;t listed
              </button>
            </div>
          )}

          {/* No match */}
          {noMatch && (
            <div className="mt-6 space-y-3 text-left">
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 className="font-bold text-white text-xl mb-2">
                  We don&apos;t have your building yet
                </h3>
                <p className="text-sm text-gray-400">
                  Help us grow the database — add your building and be the first
                  resident to join.
                </p>
              </div>
              <Link
                href={"/signup?postcode=" + encodeURIComponent(postcode)}
                className="block w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold text-lg text-center"
              >
                Add your building
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gray-900 py-20 px-6">
        <h3 className="text-3xl font-bold text-center mb-12">How it works</h3>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">1</div>
            <h4 className="text-xl font-semibold mb-2">Search your address</h4>
            <p className="text-gray-400">
              Enter your postcode and pick your address. We&apos;ll find your
              building instantly.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">2</div>
            <h4 className="text-xl font-semibold mb-2">See your building</h4>
            <p className="text-gray-400">
              Find out who your managing agent is, what issues have been raised,
              and who your freeholder is.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">3</div>
            <h4 className="text-xl font-semibold mb-2">
              Join and take action
            </h4>
            <p className="text-gray-400">
              Sign up free to see full details, raise issues, and rally your
              neighbours.
            </p>
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div className="py-20 px-6">
        <h3 className="text-3xl font-bold text-center mb-4">
          This is just the beginning
        </h3>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
          Today, BlockVoice helps you raise issues and rally your neighbours.
          But we are building something much bigger.
        </p>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              title: "AI-powered escalation",
              desc: "Intelligent agents that draft formal complaints, track responses, and follow up automatically when your managing agent goes silent.",
            },
            {
              title: "Service charge analysis",
              desc: "Upload your service charge statement and let AI flag anomalies, compare costs across buildings, and identify where you are being overcharged.",
            },
            {
              title: "Coordinated action",
              desc: "Organise group complaints, petitions, and formal disputes with templates and step-by-step guidance built for leaseholders.",
            },
            {
              title: "Real-time tracking",
              desc: "Monitor building works, track contractor activity, and hold your freeholder accountable with a shared timeline everyone can see.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <h4 className="text-white font-bold mb-2">{item.title}</h4>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-gray-900 py-16 px-6 text-center">
        <h3 className="text-3xl font-bold mb-4">Take back control</h3>
        <p className="text-gray-400 mb-8">
          Your building has a voice. Make it heard.
        </p>
        <Link
          href="/signup"
          className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-10 py-4 rounded-lg font-semibold"
        >
          Get Started — It&apos;s Free
        </Link>
      </div>

      <footer className="text-center text-gray-500 py-10">
        <p>2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}
