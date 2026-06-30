"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NewsletterSignup() {
  const [email, setEmail]     = useState("");
  const [status, setStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg]   = useState("");
  const sb = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setStatus("error"); setErrMsg("Enter a valid email."); return; }
    setStatus("loading"); setErrMsg("");
    const { error } = await sb.from("newsletter_subscribers").insert({ email: email.trim().toLowerCase() });
    if (error) {
      if (error.code === "23505") { setStatus("done"); } // already subscribed — treat as success
      else { setStatus("error"); setErrMsg("Something went wrong. Try again."); }
      return;
    }
    setStatus("done");
  }

  return (
    <section className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-gold">Newsletter</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Join Our Email List</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Stay in-the-know about GST promotions, launches, and events.
          </p>

          {status === "done" ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
              🎉 You&apos;re subscribed! Thanks for joining.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-navy"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-2xl bg-brand-navy px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {status === "loading" ? "Joining…" : "Join Now"}
              </button>
            </form>
          )}
          {status === "error" && <p className="mt-3 text-sm font-semibold text-rose-600">{errMsg}</p>}
        </div>
      </div>
    </section>
  );
}
