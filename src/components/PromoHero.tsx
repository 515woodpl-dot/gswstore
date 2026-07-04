"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/720x540/f1f5f9/64748b?text=Golden+Stone+Tools";

function discountPct(item: InventoryItem): number {
  if (item.sale_price != null && item.store_price > 0 && item.sale_price < item.store_price) {
    return Math.floor(((item.store_price - item.sale_price) / item.store_price) * 100);
  }
  return 0;
}

export default function PromoHero({ items }: { items: InventoryItem[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => setIndex((p) => (p + 1) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, next]);

  if (count === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div>
          <p className="text-lg font-bold text-slate-900">No featured products yet</p>
          <p className="mt-2 text-sm text-slate-600">Mark products as &quot;featured&quot; in the admin panel to show them here.</p>
        </div>
      </div>
    );
  }

  const item = items[index];
  const img = item.image_url || item.images?.[0] || PLACEHOLDER;
  const pct = discountPct(item);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid items-center gap-0 md:grid-cols-2">
        {/* Left — copy */}
        <div className="order-2 flex flex-col justify-center gap-4 p-8 sm:p-10 lg:p-12 md:order-1">
          {pct > 0 ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-primary">
              🔥 Up to {pct}% Off
            </span>
          ) : (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-navy">
              ★ Featured
            </span>
          )}

          {item.category_name && (
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{item.category_name}</p>
          )}

          <h2 className="text-3xl font-black leading-[1.1] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            {item.name}
          </h2>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            {item.sale_price ? (
              <>
                <span className="text-2xl font-black text-brand-primary">{formatPrice(item.sale_price)}</span>
                <span className="text-lg font-semibold text-slate-400 line-through">{formatPrice(item.store_price)}</span>
              </>
            ) : (
              <span className="text-2xl font-black text-slate-900">{formatPrice(item.store_price)}</span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Link
              href={`/shop/product/${item.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              Shop Now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>

            {/* Dots inline */}
            {count > 1 && (
              <div className="flex gap-1.5">
                {items.map((_, i) => (
                  <button key={i} onClick={() => go(i)} aria-label={`Slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand-gold" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — product image on soft panel */}
        <div className="order-1 flex items-center justify-center bg-slate-50 p-8 sm:p-10 md:order-2 md:min-h-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={item.name}
            className="max-h-[300px] w-full rounded-2xl object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          />
        </div>
      </div>
    </div>
  );
}
