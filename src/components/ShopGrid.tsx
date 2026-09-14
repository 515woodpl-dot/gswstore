"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { StockBadge } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "https://placehold.co/720x540/2b353f/cac9cc?text=Stone+Product+Supply";

function ProductCard({ item }: { item: InventoryItem }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const canAdd = item.stock_status !== "out_of_stock";

  async function handleAdd() {
    if (!user) { router.push("/auth/login?next=/"); return; }
    if (!canAdd) return;
    setAdding(true);
    try { await addItem(item); setAdded(true); setTimeout(() => setAdded(false), 2000); }
    finally { setAdding(false); }
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-white/15 bg-white text-brand-navy shadow-[0_16px_35px_rgba(0,0,0,0.12)] transition hover:-translate-y-1 hover:border-brand-gold">
      <Link href={`/shop/product/${item.id}`} className="block">
        <div className="relative aspect-[16/11] overflow-hidden bg-[#e5e1da] sm:aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url || PLACEHOLDER}
            alt={item.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-blue">{item.category_name}{item.sku ? ` · ${item.sku}` : ""}</p>
          <h3 className="font-display text-lg font-black uppercase leading-tight tracking-[-0.025em] text-brand-navy sm:text-xl">
            <Link href={`/shop/product/${item.id}`} className="hover:text-brand-gold">{item.name}</Link>
          </h3>
          {item.description && <p className="line-clamp-2 pt-1 text-xs leading-5 text-slate-500">{item.description}</p>}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            {item.sale_price ? (
              <div className="flex items-baseline gap-2">
                <p className="font-display text-2xl font-black tracking-tight text-brand-gold">{formatPrice(item.sale_price)}</p>
                <p className="text-xs font-semibold text-slate-400 line-through">{formatPrice(item.store_price)}</p>
              </div>
            ) : (
              <p className="font-display text-2xl font-black tracking-tight text-brand-navy">{formatPrice(item.store_price)}</p>
            )}
            
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !canAdd}
            className={[
              "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap border px-4 py-2 text-[10px] font-black uppercase tracking-wide transition",
              added ? "bg-emerald-600 text-white" :
              canAdd ? "border-brand-navy bg-brand-navy text-white hover:border-brand-gold hover:bg-brand-gold" :
              "cursor-not-allowed bg-slate-200 text-slate-500",
            ].join(" ")}
          >
            {adding ? "Adding…" : added ? "✓ Added" : canAdd ? "Add" : "Out"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Pickup only</span>
          <StockBadge status={item.stock_status} />
        </div>
      </div>
    </article>
  );
}

const PAGE_SIZE = 10;

export default function ShopGrid({ items, cat, q, basePath = "/" }: { items: InventoryItem[]; cat?: string; q?: string; basePath?: "/" | "/shop" }) {
  const [page, setPage] = useState(1);

  let filtered = items;
  if (cat) filtered = filtered.filter((i) => i.category_name === cat);
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((i) =>
      [i.name, i.sku, i.category_name, i.description, i.brand, i.model_number].join(" ").toLowerCase().includes(ql)
    );
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filter changes
  const prevFilter = [cat, q].join("|");
  const [lastFilter, setLastFilter] = useState(prevFilter);
  if (prevFilter !== lastFilter) { setLastFilter(prevFilter); setPage(1); }

  if (filtered.length === 0) {
    return (
      <div className="border border-dashed border-white/25 bg-white/5 px-6 py-14 text-center">
        <p className="font-display text-xl font-black uppercase text-white">No products match that search.</p>
        <p className="mt-2 text-sm text-white/55">Try a different category or a shorter keyword.</p>
        {(cat || q) && <Link href={`${basePath}#catalog`} className="mt-5 inline-flex bg-brand-gold px-5 py-3 text-xs font-black uppercase text-white">Clear filters</Link>}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
        {paginated.map((item) => <ProductCard key={item.id} item={item} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="border border-white/20 px-4 py-2 text-xs font-bold text-white disabled:opacity-30 hover:border-white">
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`h-9 w-9 text-xs font-bold transition ${p === page ? "bg-brand-gold text-white" : "border border-white/20 text-white/60 hover:border-white"}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="border border-white/20 px-4 py-2 text-xs font-bold text-white disabled:opacity-30 hover:border-white">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
