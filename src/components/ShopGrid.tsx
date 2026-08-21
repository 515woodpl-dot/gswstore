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
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <Link href={`/shop/product/${item.id}`} className="block">
        <div className="relative aspect-[16/11] overflow-hidden bg-slate-900 sm:aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url || PLACEHOLDER}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          />
          <div className="absolute left-4 top-4">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-navy">
              {item.category_name}
            </span>
          </div>
          <div className="absolute bottom-4 left-4">
            <StockBadge status={item.stock_status} />
          </div>
        </div>
      </Link>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.sku}</p>
          <h3 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            <Link href={`/shop/product/${item.id}`} className="hover:text-brand-navy">{item.name}</Link>
          </h3>
          {item.description && <p className="text-sm leading-6 text-slate-600 line-clamp-2">{item.description}</p>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {item.sale_price ? (
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl">{formatPrice(item.sale_price)}</p>
                <p className="text-sm font-semibold text-slate-400 line-through">{formatPrice(item.store_price)}</p>
                <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white">Sale</span>
              </div>
            ) : (
              <p className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{formatPrice(item.store_price)}</p>
            )}
            
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !canAdd}
            className={[
              "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs",
              added ? "bg-emerald-600 text-white" :
              canAdd ? "bg-brand-navy text-white hover:bg-slate-800" :
              "cursor-not-allowed bg-slate-200 text-slate-500",
            ].join(" ")}
          >
            {adding ? "Adding…" : added ? "✓ Added" : canAdd ? "Add" : "Out"}
          </button>
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
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        <p className="text-lg font-semibold text-slate-900">No products match that search.</p>
        <p className="mt-2 text-sm text-slate-600">Try a different category or a shorter keyword.</p>
        {(cat || q) && <Link href={basePath} className="mt-4 inline-flex rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">Clear filters</Link>}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-5">
        {paginated.map((item) => <ProductCard key={item.id} item={item} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50">
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`h-9 w-9 rounded-xl text-sm font-bold transition ${p === page ? "bg-brand-navy text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
