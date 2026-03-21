"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

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
    <div className="min-h-screen text-white py-12 px-4" style={{ background: "var(--navy)" }}>
      <div className="max-w-md mx-auto">
        <Link href="/" className="font-extrabold text-[17px] mb-6 block" style={{ color: "var(--teal)" }}>BlockVoice</Link>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--teal)" }}>
          Welcome Back
        </h1>
        <p className="mb-8" style={{ color: "var(--t2)" }}>Log in to your BlockVoice account.</p>

        {error && (
          <div className="bg-red-900/60 text-red-200 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-[rgba(255,255,255,0.55)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#162d50] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full text-white py-3 rounded-lg font-semibold text-lg disabled:opacity-50"
            style={{ background: "var(--teal)" }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <p className="text-center text-[rgba(255,255,255,0.55)]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#1ec6a4] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}