"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthHoneypots from "@/components/AuthHoneypots";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [traps, setTraps] = useState({ website: "", faxNumber: "", contactPreference: "" });
  const startedAt = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const securityCheck = useSearchParams().get("security") === "1";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function handle(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, startedAt: startedAt.current ?? 0, ...traps }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not start password recovery.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not start password recovery. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-lg items-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Password recovery</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Reset your password</h1>
        {securityCheck && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">We found an account-session inconsistency and signed you out. Request a reset link to secure your account.</p>}
        {done ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">If an account exists for that email, we sent a password-reset link.</p> : <form onSubmit={handle} className="relative mt-6 space-y-5"><AuthHoneypots values={traps} onChange={(patch) => setTraps((current) => ({ ...current, ...patch }))} /><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-navy" placeholder="name@company.com" /></label>{error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-70">{loading ? "Sending..." : "Send reset link"}</button></form>}
        <Link href="/auth/login" className="mt-6 inline-flex text-sm font-semibold text-brand-navy hover:text-slate-800">Back to Sign In</Link>
      </div>
    </div>
  );
}
