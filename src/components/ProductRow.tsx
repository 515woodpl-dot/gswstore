"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/400x400/f1f5f9/64748b?text=No+Image";

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
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.24em] ${accentClasses}`}>{title}</p>
          {subtitle && <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{subtitle}</h2>}
        </div>
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {items.map((item) => {
          const img = item.image_url || item.images?.[0] || PLACEHOLDER;
          return (
            <Link key={item.id} href={`/shop/product/${item.id}`}
              className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-gold hover:shadow-md sm:w-52">
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                {item.sale_price && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-0.5 text-[0.62rem] font-bold uppercase text-white">Sale</span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  {item.sale_price ? (
                    <>
                      <span className="text-sm font-bold text-brand-primary">{formatPrice(item.sale_price)}</span>
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
