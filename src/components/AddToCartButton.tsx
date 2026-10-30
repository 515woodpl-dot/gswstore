"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { QuantitySelector } from "@/components/ui";
import type { InventoryItem } from "@/types";
import { formatPrice } from "@/lib/utils";

export default function AddToCartButton({ item, onPackageChange }: { item: InventoryItem; onPackageChange?: (box: boolean) => void }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [box, setBox] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const packSize = box ? 24 : (item.units_per_sale ?? 1);
  const maxQty = Math.floor(item.amount / packSize);
  const canAdd = maxQty > 0;
  const boxUnavailable = item.amount < 24;

  async function handleAdd() {
    if (!user) { router.push(`/auth/login?next=/shop/product/${item.id}`); return; }
    setAdding(true); setError("");
    try {
      const selected = box ? { ...item, name: `${item.name} — Box of 24`, store_price: item.box_price!, sale_price: null, selling_unit: "Box", units_per_sale: 24 } : item;
      await addItem(selected, qty); setAdded(true); setTimeout(() => setAdded(false), 3000);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add to cart."); }
    finally { setAdding(false); }
  }

  if (!canAdd && !item.box_enabled) return (
    <div className="space-y-3">
      <button disabled className="inline-flex w-full cursor-not-allowed items-center justify-center bg-slate-200 px-6 py-4 text-xs font-black uppercase tracking-wide text-slate-500 sm:w-auto">
        Out of Stock
      </button>
      <p className="text-sm text-slate-500">Contact us about availability.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {item.box_enabled && item.box_price != null && <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Package size">
        <button type="button" aria-pressed={!box} onClick={() => { setBox(false); setQty(1); onPackageChange?.(false); }} className={`border p-3 text-left text-sm font-bold ${!box ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300"}`}>Single · {formatPrice(item.sale_price ?? item.store_price)}</button>
        <button type="button" aria-pressed={box} disabled={boxUnavailable} onClick={() => { setBox(true); setQty(1); onPackageChange?.(true); }} className={`border p-3 text-left text-sm font-bold ${boxUnavailable ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : box ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300"}`}>
          Box of 24 · {formatPrice(item.box_price)}
          {boxUnavailable && <span className="mt-1 block text-xs font-normal">Unavailable · {item.amount} tubes in stock</span>}
        </button>
      </div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <QuantitySelector value={qty} onChange={setQty} max={maxQty} />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !canAdd}
          className={[
            "inline-flex min-h-[48px] flex-1 items-center justify-center px-7 py-3 text-xs font-black uppercase tracking-wide transition",
            added ? "bg-emerald-600 text-white" : "bg-brand-gold text-white shadow-[5px_5px_0_#13212c] hover:-translate-y-0.5 hover:bg-[#b94721] disabled:opacity-70",
          ].join(" ")}
        >
          {adding ? "Adding…" : added ? "✓ Added to Cart" : !canAdd ? "Out of Stock" : "Add to Cart"}
        </button>
        {added && (
          <Link href="/cart" className="inline-flex min-h-[48px] items-center justify-center border border-brand-navy bg-white px-5 py-3 text-xs font-black uppercase text-brand-navy transition hover:bg-brand-navy hover:text-white">
            View Cart
          </Link>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
