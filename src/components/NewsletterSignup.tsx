"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";

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
    <section className="border-t border-slate-300 bg-[#f4efe7]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Counter notes</p>
          <h2 className="font-display mt-3 text-4xl font-black uppercase leading-none tracking-[-0.05em] text-brand-navy sm:text-5xl">Know what just landed.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {`Stay in-the-know about ${BRAND.shortName} promotions, launches, and events.`}
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
              className="flex-1 border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-gold"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-brand-navy px-6 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-brand-gold disabled:opacity-60"
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
