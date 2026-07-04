"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { QuantitySelector } from "@/components/ui";
import type { InventoryItem } from "@/types";

export default function AddToCartButton({ item }: { item: InventoryItem }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const canAdd = item.stock_status !== "out_of_stock";

  async function handleAdd() {
    if (!user) { router.push(`/auth/login?next=/shop/product/${item.id}`); return; }
    setAdding(true);
    try { await addItem(item, qty); setAdded(true); setTimeout(() => setAdded(false), 3000); }
    finally { setAdding(false); }
  }

  if (!canAdd) return (
    <div className="space-y-3">
      <button disabled className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500 sm:w-auto">
        Out of Stock
      </button>
      <p className="text-sm text-slate-500">Contact us about availability.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <QuantitySelector value={qty} onChange={setQty} max={item.amount} />
      <button
        type="button"
        onClick={handleAdd}
        disabled={adding}
        className={[
          "inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition",
          added ? "bg-emerald-600 text-white" : "bg-brand-navy text-white hover:bg-slate-800 disabled:opacity-70",
        ].join(" ")}
      >
        {adding ? "Adding…" : added ? "✓ Added to Cart" : "Add to Cart"}
      </button>
      {added && (
        <Link href="/cart" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
          View Cart
        </Link>
      )}
    </div>
  );
}
