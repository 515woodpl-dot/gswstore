"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Stars } from "@/components/Stars";
import type { Review } from "@/types";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function ProductReviews({
  itemId,
  initialReviews,
}: {
  itemId: string;
  initialReviews: Review[];
}) {
  const { user, loading } = useAuth();
  const sb = createClient();

  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10 : 0;
  const myExisting = user ? reviews.find((r) => r.user_id === user.id) : undefined;

  // Rating distribution (5→1)
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => r.rating === star).length,
  }));

  async function submit() {
    setError("");
    if (!user) return;
    if (rating < 1) { setError("Please select a star rating."); return; }
    if (!body.trim()) { setError("Please write a short review."); return; }

    setSaving(true);
    const authorName =
      name.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      (user.email ? user.email.split("@")[0] : "Customer");

    const payload = {
      item_id: itemId,
      user_id: user.id,
      author_name: authorName,
      rating,
      title: title.trim(),
      body: body.trim(),
    };

    // Upsert on (item_id, user_id) so a customer editing re-submits cleanly.
    const { data, error: err } = await sb
      .from("reviews")
      .upsert(payload, { onConflict: "item_id,user_id" })
      .select("id,item_id,user_id,author_name,rating,title,body,approved,created_at")
      .single();

    if (err) { setError(err.message); setSaving(false); return; }

    const saved = data as Review;
    setReviews((prev) => {
      const without = prev.filter((r) => r.user_id !== user.id);
      return saved.approved ? [saved, ...without] : without;
    });
    setSaving(false);
    setDone(true);
    if (!saved.approved) setError("");
  }

  function startEdit(r: Review) {
    setRating(r.rating);
    setTitle(r.title);
    setBody(r.body);
    setName(r.author_name);
    setDone(false);
  }

  return (
    <section className="mt-12 border-t border-slate-100 pt-10">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Customer reviews</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            {count > 0 ? `${average.toFixed(1)} out of 5` : "No reviews yet"}
          </h2>
          {count > 0 && <Stars value={average} size={20} />}
          {count > 0 && <span className="text-sm text-slate-500">({count} review{count === 1 ? "" : "s"})</span>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Distribution + write form */}
        <div className="space-y-6">
          {count > 0 && (
            <div className="space-y-1.5">
              {dist.map(({ star, n }) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-slate-500">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-gold" style={{ width: count ? `${(n / count) * 100}%` : "0%" }} />
                  </div>
                  <span className="w-6 text-right text-slate-400">{n}</span>
                </div>
              ))}
            </div>
          )}

          {/* Write a review */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-slate-900">
              {myExisting ? "Update your review" : "Write a review"}
            </h3>

            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : !user ? (
              <p className="text-sm text-slate-600">
                Please{" "}
                <Link href="/auth/login" className="font-semibold text-brand-navy hover:underline">
                  sign in
                </Link>{" "}
                to leave a review.
              </p>
            ) : done ? (
              <div className="text-sm">
                <p className="font-semibold text-emerald-700">Thanks — your review was posted!</p>
                <button onClick={() => setDone(false)} className="mt-2 font-semibold text-brand-navy hover:underline">
                  Edit it
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Star picker */}
                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHover(s)}
                      aria-label={`${s} star${s > 1 ? "s" : ""}`}
                      className="p-0.5"
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24">
                        <path
                          d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"
                          fill={(hover || rating) >= s ? "#ef5123" : "#e2e8f0"}
                        />
                      </svg>
                    </button>
                  ))}
                </div>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Display name (optional)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Share your experience with this product…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                {error && <p className="text-sm text-rose-600">{error}</p>}

                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                >
                  {saving ? "Posting…" : myExisting ? "Update review" : "Post review"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Review list */}
        <div className="space-y-5">
          {count === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
              Be the first to review this product.
            </p>
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Stars value={r.rating} />
                    {r.title && <h4 className="mt-1.5 font-bold text-slate-900">{r.title}</h4>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                </div>
                {r.body && <p className="mt-2 text-sm leading-6 text-slate-600">{r.body}</p>}
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {r.author_name || "Customer"}
                  {user && r.user_id === user.id && (
                    <>
                      {" · "}
                      <button onClick={() => startEdit(r)} className="text-brand-navy hover:underline">
                        edit yours
                      </button>
                    </>
                  )}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
