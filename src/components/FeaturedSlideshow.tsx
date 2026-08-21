"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "@/lib/utils";
import { StockBadge } from "@/components/ui";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/720x540/1e3a5f/ffffff?text=Golden+Stone+Tools";

export default function FeaturedSlideshow({ items }: { items: InventoryItem[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => setIndex((p) => (p + 1) % count), [count]);

  // Auto-advance every 5s
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, next]);

  if (count === 0) return null;

  const item = items[index];
  const img = item.image_url || item.images?.[0] || PLACEHOLDER;

  return (
    <div className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-soft">
      {/* Slide */}
      <Link href={`/shop/product/${item.id}`} className="block h-full">
        <div className="relative h-full min-h-[260px] sm:min-h-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={item.name} className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-500"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

          {/* Top-left badges */}
          <div className="absolute left-4 top-4 flex items-center gap-2 sm:left-5 sm:top-5">
            <span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">Featured</span>
            <StockBadge status={item.stock_status} />
          </div>

          {/* Bottom content */}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{item.category_name}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-3xl">{item.name}</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              {item.sale_price ? (
                <span className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-brand-gold">{formatPrice(item.sale_price)}</span>
                  <span className="text-base font-semibold text-white/50 line-through">{formatPrice(item.store_price)}</span>
                </span>
              ) : (
                <span className="text-2xl font-bold">{formatPrice(item.store_price)}</span>
              )}
              <span className="inline-flex w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-navy">View Product</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Arrows */}
      {count > 1 && (
        <>
          <button onClick={() => go(index - 1)} aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 text-slate-900 shadow transition hover:bg-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => go(index + 1)} aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 text-slate-900 shadow transition hover:bg-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {items.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
