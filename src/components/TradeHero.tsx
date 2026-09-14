"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const FALLBACK_IMAGE = "/brand/sps-logo-square.png";

export default function TradeHero({ items }: { items: InventoryItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  const item = items[activeIndex] ?? items[0];
  const image = item.image_url || item.images?.[0] || FALLBACK_IMAGE;
  const currentPrice = item.sale_price ?? item.store_price;

  return (
    <section className="sps-grid-texture bg-[#fbfaf7]" aria-roledescription="carousel" aria-label="Featured products">
      <div className="mx-auto grid max-w-7xl lg:min-h-[650px] lg:grid-cols-[0.88fr_1.12fr]">
        <div className="flex flex-col justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Featured from our current inventory</p>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-blue">{item.category_name || item.brand || "Shop essential"}</p>
          <h1 className="font-display mt-3 text-[clamp(3.2rem,6.4vw,6.2rem)] font-black uppercase leading-[0.84] tracking-[-0.065em] text-brand-navy">
            {item.name}
          </h1>
          {item.description && <p className="mt-7 line-clamp-3 max-w-lg whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">{item.description}</p>}
          <div className="mt-6 flex flex-wrap items-end gap-3">
            {currentPrice > 0 && <strong className="font-display text-3xl font-black text-brand-navy">{formatPrice(currentPrice)}</strong>}
            {item.sale_price != null && item.sale_price < item.store_price && <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(item.store_price)}</span>}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href={`/shop/product/${item.id}`} className="inline-flex min-h-[52px] items-center gap-8 bg-brand-gold px-6 py-4 text-xs font-black uppercase tracking-wide text-white shadow-[7px_7px_0_#13212c] transition hover:-translate-y-0.5 hover:bg-[#b94721]">View product <span>↗</span></Link>
            <Link href="#catalog" className="border-b border-brand-navy pb-1 text-xs font-black text-brand-navy hover:text-brand-gold">Shop the catalog →</Link>
          </div>

          {items.length > 1 && (
            <div className="mt-10 flex items-center gap-2" aria-label="Choose a featured product">
              {items.map((featuredItem, index) => (
                <button
                  key={featuredItem.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show ${featuredItem.name}`}
                  aria-current={index === activeIndex}
                  className={`h-2 transition-all ${index === activeIndex ? "w-9 bg-brand-gold" : "w-4 bg-slate-300 hover:bg-brand-blue"}`}
                />
              ))}
            </div>
          )}

          <dl className="mt-12 grid grid-cols-3 border-t border-slate-300 pt-5">
            <div><dt className="font-display text-sm font-black uppercase">Pickup</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Prepared at our counter</dd></div>
            <div className="border-l border-slate-300 pl-4"><dt className="font-display text-sm font-black uppercase">Local</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Auburn, Washington</dd></div>
            <div className="border-l border-slate-300 pl-4"><dt className="font-display text-sm font-black uppercase">Live stock</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">{item.amount > 0 ? `${item.amount} currently available` : "Check availability"}</dd></div>
          </dl>
        </div>

        <div className="relative min-h-[440px] p-4 pb-14 sm:p-8 sm:pb-16 lg:py-10 lg:pl-12 lg:pr-0">
          <div className="absolute inset-x-8 bottom-20 top-16 translate-x-3 translate-y-3 border border-slate-400/60 lg:right-[-24px]" />
          <Link href={`/shop/product/${item.id}`} className="relative block h-full min-h-[390px] overflow-hidden bg-slate-200 shadow-[0_22px_60px_rgba(19,33,44,0.16)] sm:min-h-[500px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={image} src={image} alt={item.name} className={`h-full w-full ${image === FALLBACK_IMAGE ? "object-contain p-20" : "object-cover"}`} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; event.currentTarget.className = "h-full w-full object-contain p-20"; }} />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/10 via-transparent to-transparent" />
          </Link>
          <div className="absolute bottom-5 right-2 flex items-center gap-3 border-t-[3px] border-brand-gold bg-white px-5 py-4 shadow-xl sm:right-5">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${item.amount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.amount > 0 ? "✓" : "–"}</span>
            <p className="text-[10px] text-slate-500"><b className="block text-xs text-brand-navy">{item.amount > 0 ? "Ready for pickup" : "Check availability"}</b>{item.amount > 0 ? `${item.amount} in current inventory` : "Contact the counter"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
