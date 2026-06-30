"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/720x540/1e3a5f/ffffff?text=Golden+Stone+Tools";

// Discount % from sale vs store price, rounded down.
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
      <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div>
          <p className="text-lg font-bold text-slate-900">No featured products yet</p>
          <p className="mt-2 text-sm text-slate-600">Mark products as “featured” in the admin panel to show them here.</p>
        </div>
      </div>
    );
  }

  const item = items[index];
  const img = item.image_url || item.images?.[0] || PLACEHOLDER;
  const pct = discountPct(item);
  const eyebrow = pct > 0 ? `Up To ${pct}% Discount` : "Featured Product";

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-soft">
      <div className="grid items-stretch md:grid-cols-2">
        {/* Left — copy */}
        <div className="relative z-10 flex flex-col justify-center gap-5 p-8 sm:p-10 lg:p-14">
          <p className="text-sm font-medium text-white/70 sm:text-base">{eyebrow}</p>
          <h2 className="text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {item.category_name && <span className="block">{item.category_name}</span>}
            <span className="block">{item.name}</span>
          </h2>
          <div>
            <Link
              href={`/shop/product/${item.id}`}
              className="inline-flex items-center rounded-md bg-brand-gold px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:brightness-110"
            >
              Shop Now
            </Link>
          </div>
        </div>

        {/* Right — product image */}
        <div className="relative min-h-[240px] md:min-h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          />
          {/* blend image into the dark panel on the left edge */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/30 to-transparent md:via-slate-900/10" />
        </div>
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-4 left-8 z-20 flex gap-2 sm:left-10 lg:left-14">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2.5 rounded-full transition-all ${i === index ? "w-2.5 bg-brand-gold" : "w-2.5 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
