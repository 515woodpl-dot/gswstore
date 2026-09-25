"use client";

import { useEffect, useState } from "react";
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
  const [modalOpen, setModalOpen] = useState(false);

  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10 : 0;
  const myExisting = user ? reviews.find((r) => r.user_id === user.id) : undefined;

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [modalOpen]);

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
    setModalOpen(true);
  }

  function openReviewForm() {
    if (myExisting) startEdit(myExisting);
    else setModalOpen(true);
  }

  function reviewCard(review: Review, compact = false) {
    return (
      <article key={review.id} className={`border border-slate-300 bg-white ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Stars value={review.rating} />
            {review.title && <h4 className="mt-1.5 font-bold text-slate-900">{review.title}</h4>}
          </div>
          <span className="shrink-0 text-xs text-slate-400">{fmtDate(review.created_at)}</span>
        </div>
        {review.body && <p className={`mt-2 text-sm leading-6 text-slate-600 ${compact ? "line-clamp-3" : ""}`}>{review.body}</p>}
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {review.author_name || "Customer"}
          {user && review.user_id === user.id && (
            <>{" · "}<button onClick={() => startEdit(review)} className="text-brand-navy hover:underline">edit yours</button></>
          )}
        </p>
      </article>
    );
  }

  function reviewForm() {
    return (
      <div className="border border-slate-300 bg-white p-5">
        <h3 className="mb-3 text-base font-bold text-slate-900">{myExisting ? "Update your review" : "Write a review"}</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !user ? (
          <p className="text-sm text-slate-600">Please <Link href="/auth/login" className="font-semibold text-brand-navy hover:underline">sign in</Link> to leave a review.</p>
        ) : done ? (
          <div className="text-sm"><p className="font-semibold text-emerald-700">Thanks — your review was posted!</p><button onClick={() => setDone(false)} className="mt-2 font-semibold text-brand-navy hover:underline">Edit it</button></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((score) => (
                <button key={score} type="button" onClick={() => setRating(score)} onMouseEnter={() => setHover(score)} aria-label={`${score} star${score > 1 ? "s" : ""}`} className="p-0.5">
                  <svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" fill={(hover || rating) >= score ? "#ef5123" : "#e2e8f0"} /></svg>
                </button>
              ))}
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name (optional)" className="w-full border border-slate-300 px-3 py-2 text-sm" />
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" className="w-full border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Share your experience with this product…" className="w-full border border-slate-300 px-3 py-2 text-sm" />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button onClick={submit} disabled={saving} className="w-full bg-brand-navy px-4 py-3 text-xs font-black uppercase tracking-wide text-white hover:bg-brand-gold disabled:opacity-70">{saving ? "Posting…" : myExisting ? "Update review" : "Post review"}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="mt-6 min-h-[260px] border-t border-slate-300 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Customer reviews</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl font-black uppercase tracking-[-0.04em] text-brand-navy">{count > 0 ? `${average.toFixed(1)} out of 5` : "No reviews yet"}</h2>{count > 0 && <Stars value={average} size={18} />}{count > 0 && <span className="text-xs text-slate-500">({count})</span>}</div></div>
        <button type="button" onClick={openReviewForm} className="min-h-10 border border-brand-navy px-4 text-[10px] font-black uppercase tracking-wide text-brand-navy hover:bg-brand-navy hover:text-white">{myExisting ? "Update your review" : "Write a review"}</button>
      </div>

      {count === 0 ? (
        <button type="button" onClick={openReviewForm} className="mt-4 flex min-h-32 w-full items-center justify-center border border-dashed border-slate-300 bg-white/50 px-5 text-sm text-slate-500 hover:border-brand-gold hover:text-brand-navy">Be the first to review this product.</button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviews.slice(0, 2).map((review) => reviewCard(review, true))}</div>
      )}
      {count > 0 && <button type="button" onClick={() => setModalOpen(true)} className="mt-3 min-h-10 text-xs font-black text-brand-gold underline decoration-brand-gold/40 underline-offset-4 hover:text-[#b94721]">Read more reviews →</button>}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-brand-navy/75 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reviews-modal-title" className="mx-auto my-4 max-w-5xl bg-[#fbfaf7] shadow-2xl sm:my-8">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-gold">Customer reviews</p><h2 id="reviews-modal-title" className="font-display text-2xl font-black uppercase text-brand-navy">{count > 0 ? `${average.toFixed(1)} out of 5` : "Review this product"}</h2></div><button type="button" onClick={() => setModalOpen(false)} aria-label="Close reviews" className="grid h-11 w-11 place-items-center border border-slate-300 text-xl text-brand-navy hover:bg-white">×</button></header>
            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[300px_1fr]">
              <div className="space-y-5">
                {count > 0 && <div className="space-y-1.5">{dist.map(({ star, n }) => <div key={star} className="flex items-center gap-2 text-sm"><span className="w-8 text-slate-500">{star}★</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-gold" style={{ width: `${(n / count) * 100}%` }} /></div><span className="w-6 text-right text-slate-400">{n}</span></div>)}</div>}
                {reviewForm()}
              </div>
              <div className="space-y-4">{count === 0 ? <p className="border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">Be the first to review this product.</p> : reviews.map((review) => reviewCard(review))}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
