"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handle(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) { setError("Use a password with at least 12 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("This reset link is invalid or expired. Request a new one.");
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-lg items-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Password recovery</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Choose a new password</h1>
        {done ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Password updated. Sign in with your new password.</p> : <form onSubmit={handle} className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">New password</span><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-navy" /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">Confirm new password</span><PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} autoComplete="new-password" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-navy" /></label>{error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-70">{loading ? "Updating..." : "Update password"}</button></form>}
        <Link href="/auth/login" className="mt-6 inline-flex text-sm font-semibold text-brand-navy hover:text-slate-800">Back to Sign In</Link>
      </div>
    </div>
  );
}
