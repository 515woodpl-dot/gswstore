"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/900x720/f1f5f9/435d69?text=Golden+Stone+Supply";

function discountPct(item: InventoryItem): number {
  if (item.sale_price != null && item.store_price > 0 && item.sale_price < item.store_price) {
    return Math.floor(((item.store_price - item.sale_price) / item.store_price) * 100);
  }
  return 0;
}

export default function PromoHero({ items }: { items: InventoryItem[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 5500);
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;

  const activeIndex = index % count;
  const item = items[activeIndex] ?? items[0];
  const image = item.image_url || item.images?.[0] || PLACEHOLDER;
  const discount = discountPct(item);
  const currentPrice = item.sale_price != null && item.sale_price < item.store_price ? item.sale_price : item.store_price;

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#dce2e7] bg-[#EEF1F4] shadow-[0_18px_55px_rgba(67,93,105,0.12)]">
      <div className="absolute -left-12 bottom-8 h-32 w-32 rounded-full border border-brand-primary/30" />
      <div className="absolute -left-6 bottom-16 h-px w-40 rotate-[-20deg] bg-brand-primary/50" />
      <div className="absolute right-[11%] top-[-5rem] h-52 w-52 rounded-[42%_58%_63%_37%/43%_39%_61%_57%] bg-brand-primary/30" />

      <div className="relative grid min-h-[480px] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="order-2 flex flex-col justify-center px-7 py-10 sm:px-12 lg:order-1 lg:py-14 xl:px-16">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-primary">Golden Stone Supply</p>
          {item.category_name && <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-brand-navy/65">{item.category_name}</p>}
          <h1 className="mt-3 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-brand-navy sm:text-5xl xl:text-6xl">
            {item.name}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
            Dependable tools and materials, selected for demanding jobs and ready when your crew needs them.
          </p>

          <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
            {currentPrice > 0 && <span className="text-3xl font-black tracking-tight text-brand-navy">{formatPrice(currentPrice)}</span>}
            {discount > 0 && (
              <>
                <span className="text-base font-semibold text-slate-400 line-through">{formatPrice(item.store_price)}</span>
                <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Save {discount}%</span>
              </>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={`/shop/product/${item.id}`} className="inline-flex items-center gap-3 rounded-xl bg-brand-navy px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-brand-navy/20 transition hover:-translate-y-0.5 hover:bg-[#344b55]">
              View product
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#catalog" className="text-sm font-bold text-brand-navy underline decoration-brand-primary decoration-2 underline-offset-4 transition hover:text-brand-primary">Browse catalog</a>
          </div>

          {count > 1 && (
            <div className="mt-9 flex gap-2" aria-label="Featured products">
              {items.map((product, productIndex) => (
                <button key={product.id} type="button" onClick={() => setIndex(productIndex)} aria-label={`Show ${product.name}`} className={`h-2.5 rounded-full transition-all ${activeIndex === productIndex ? "w-8 bg-brand-primary" : "w-2.5 bg-brand-navy/20 hover:bg-brand-navy/45"}`} />
              ))}
            </div>
          )}
        </div>

        <div className="order-1 flex items-center justify-center p-5 sm:p-8 lg:order-2 lg:p-10">
          <div className="relative w-full max-w-[720px]">
            <div className="absolute -right-5 top-8 h-[84%] w-[48%] rounded-[2.5rem] bg-brand-primary/80 sm:-right-9" />
            {/* The product image sits directly on the hero, without a gray frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={item.name} className="relative mx-auto h-[340px] max-w-full rounded-[2rem] object-contain drop-shadow-[0_22px_28px_rgba(15,23,42,0.20)] sm:h-[440px] lg:h-[520px]" onError={(event) => { event.currentTarget.src = PLACEHOLDER; }} />
            <div className="absolute -bottom-5 -right-2 rounded-2xl border border-white/70 bg-white/95 px-5 py-4 shadow-xl sm:right-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Availability</p>
              <p className="mt-1 text-sm font-black text-brand-navy">{item.amount > 0 ? "Ready for pickup" : "View availability"}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
