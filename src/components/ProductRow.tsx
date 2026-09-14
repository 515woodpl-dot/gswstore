"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/400x400/2b353f/cac9cc?text=SPS";

export default function ProductRow({
  title, subtitle, items, accent = "slate",
}: {
  title: string;
  subtitle?: string;
  items: InventoryItem[];
  accent?: "slate" | "gold" | "primary";
}) {
  if (items.length === 0) return null;

  const accentClasses = {
    slate:   "text-slate-400",
    gold:    "text-brand-gold",
    primary: "text-brand-primary",
  }[accent];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-7 flex items-end justify-between border-b border-slate-300 pb-5">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.24em] ${accentClasses}`}>{title}</p>
          {subtitle && <h2 className="font-display mt-2 text-4xl font-black uppercase leading-none tracking-[-0.05em] text-brand-navy sm:text-5xl">{subtitle}</h2>}
        </div>
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {items.map((item) => {
          const img = item.image_url || item.images?.[0] || PLACEHOLDER;
          return (
            <Link key={item.id} href={`/shop/product/${item.id}`}
              className="group w-48 shrink-0 overflow-hidden border border-slate-300 bg-white transition hover:-translate-y-1 hover:border-brand-gold hover:shadow-xl sm:w-56">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#e5e1da]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                {item.sale_price && (
                  <span className="absolute left-2 top-2 bg-brand-gold px-2 py-1 text-[0.58rem] font-black uppercase tracking-wide text-white">Sale</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-display line-clamp-2 text-sm font-black uppercase leading-tight text-brand-navy">{item.name}</p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  {item.sale_price ? (
                    <>
                      <span className="text-sm font-black text-brand-gold">{formatPrice(item.sale_price)}</span>
                      <span className="text-xs text-slate-400 line-through">{formatPrice(item.store_price)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-slate-900">{formatPrice(item.store_price)}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
