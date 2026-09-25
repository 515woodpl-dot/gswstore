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
  const description = item.description.replace(/\*\*/g, "").trim();
  const productDimensions = item.dimensions || item.attributes?.Dimensions || item.attributes?.Dimension || item.attributes?.Size || "";

  return (
    <section className="sps-grid-texture bg-[#fbfaf7]" aria-roledescription="carousel" aria-label="Featured products">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
          <header className="lg:sticky lg:top-24">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Featured from our current inventory</p>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-brand-blue">{item.category_name || item.brand || "Shop essential"}</p>
            <h1 className="font-display mt-3 text-[clamp(2.8rem,5vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-brand-navy">
              {item.name}
            </h1>
            {productDimensions && <p className="mt-5 inline-flex border-l-[3px] border-brand-gold pl-3 text-xs font-black uppercase tracking-[0.12em] text-brand-blue">Dimensions · {productDimensions}</p>}
            {items.length > 1 && (
              <div className="mt-7 flex items-center gap-2" aria-label="Choose a featured product">
                {items.map((featuredItem, index) => (
                  <button key={featuredItem.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show ${featuredItem.name}`} aria-current={index === activeIndex} className={`h-2 transition-all ${index === activeIndex ? "w-9 bg-brand-gold" : "w-4 bg-slate-300 hover:bg-brand-blue"}`} />
                ))}
              </div>
            )}
          </header>

          <div>
            <Link href={`/shop/product/${item.id}`} className="flex h-[260px] items-center justify-center overflow-hidden border border-slate-200 bg-white p-4 shadow-[0_16px_44px_rgba(19,33,44,0.10)] sm:h-[330px] sm:p-6 lg:h-[370px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={image} src={image} alt={item.name} className={`h-full w-full object-contain ${image === FALLBACK_IMAGE ? "p-12" : ""}`} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; event.currentTarget.className = "h-full w-full object-contain p-12"; }} />
            </Link>

            <div className="border-x border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
              {description && <p className="whitespace-pre-line text-sm leading-6 text-slate-600 lg:columns-2 lg:gap-8">{description}</p>}
              <div className="mt-5 flex flex-col gap-5 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                  {currentPrice > 0 && <strong className="font-display text-3xl font-black text-brand-navy">{formatPrice(currentPrice)}</strong>}
                  {item.sale_price != null && item.sale_price < item.store_price && <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(item.store_price)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <Link href={`/shop/product/${item.id}`} className="inline-flex min-h-11 items-center gap-5 bg-brand-gold px-5 py-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-[#b94721]">View product <span>↗</span></Link>
                  <Link href="#catalog" className="border-b border-brand-navy pb-1 text-xs font-black text-brand-navy hover:text-brand-gold">Shop the catalog →</Link>
                </div>
              </div>

              <dl className={`mt-5 grid gap-y-4 border-t border-slate-200 pt-4 ${productDimensions ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                {productDimensions && <div><dt className="font-display text-xs font-black uppercase text-brand-navy">Dimensions</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">{productDimensions}</dd></div>}
                <div className={productDimensions ? "border-l border-slate-200 pl-4" : ""}><dt className="font-display text-xs font-black uppercase text-brand-navy">Pickup</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Prepared at our counter</dd></div>
                <div className="border-l border-slate-200 pl-4"><dt className="font-display text-xs font-black uppercase text-brand-navy">Local</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">Auburn, Washington</dd></div>
                <div className="border-l border-slate-200 pl-4"><dt className="font-display text-xs font-black uppercase text-brand-navy">Live stock</dt><dd className="mt-1 text-[9px] leading-4 text-slate-500">{item.amount > 0 ? `${item.amount} currently available` : "Check availability"}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
