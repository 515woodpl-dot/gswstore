"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const timeout = params.get("timeout") === "1";

  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const { error: err } = await createClient().auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push(next); router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-2xl items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sign In</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Access your account</h1>
        </div>
        <form onSubmit={handle} className="space-y-5">
          {timeout && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You were signed out after five minutes of inactivity.</div>}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy"
              placeholder="name@company.com" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Password</span>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} required
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" />
          </label>
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <button type="submit" disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-semibold text-slate-600 hover:text-slate-950">Back to Home</Link>
          <div className="flex gap-4">
            <Link href="/auth/forgot-password" className="font-semibold text-slate-600 hover:text-slate-950">Forgot password?</Link>
            <Link href={`/auth/register?next=${next}`} className="font-semibold text-brand-navy hover:text-slate-800">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
