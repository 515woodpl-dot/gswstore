"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import AuthHoneypots from "@/components/AuthHoneypots";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [traps, setTraps] = useState({ website: "", faxNumber: "", contactPreference: "" });
  const startedAt = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const params = useSearchParams();
  const next = params.get("next") || "/";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function handle(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password, next, startedAt: startedAt.current ?? 0, ...traps }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "We could not create that account.");
        return;
      }
      setDone(true);
    } catch {
      setError("We could not create that account. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-2xl items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Check your email</h2>
        <p className="mt-3 text-slate-600">If that email can receive registration messages, we sent a confirmation link.</p>
        <Link href="/auth/login" className="mt-6 inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 sm:w-auto">Back to Sign In</Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-2xl items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Register</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Create an account</h1>
        </div>
        <form onSubmit={handle} className="relative space-y-5">
          <AuthHoneypots values={traps} onChange={(patch) => setTraps((current) => ({ ...current, ...patch }))} />
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Full name</span><input type="text" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" placeholder="Jamie Reynolds" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" placeholder="name@company.com" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Phone number</span><input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" placeholder="(253) 555-0100" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Password</span><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" placeholder="At least 12 characters" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" /></label>
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70">{loading ? "Creating account..." : "Create Account"}</button>
        </form>
        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><Link href="/auth/login" className="font-semibold text-slate-600 hover:text-slate-950">Back to Sign In</Link><Link href="/" className="font-semibold text-brand-navy hover:text-slate-800">Return Home</Link></div>
      </div>
    </div>
  );
}
