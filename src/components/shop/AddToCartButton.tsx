"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/types";

export default function AddToCartButton({ item }: { item: InventoryItem }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const isOut = item.stock_status === "out_of_stock";

  async function handleAdd() {
    if (!user) { router.push(`/auth/login?next=/shop/product/${item.id}`); return; }
    setAdding(true);
    try { await addItem(item, qty); setAdded(true); setTimeout(() => setAdded(false), 3000); }
    catch (e) { console.error(e); }
    finally { setAdding(false); }
  }

  if (isOut) return (
    <div>
      <button className="btn btn-secondary btn-modern text-uppercase" disabled style={{ minWidth: 180 }}>Out of Stock</button>
      <p className="text-muted mt-2" style={{ fontSize: "0.85rem" }}>Contact us about availability.</p>
    </div>
  );

  return (
    <div className="d-flex align-items-center gap-3 flex-wrap">
      <div className="input-group" style={{ width: 120 }}>
        <button className="btn btn-outline-secondary" onClick={() => setQty(Math.max(1, qty - 1))} type="button">−</button>
        <input type="number" className="form-control text-center" value={qty} min={1} max={item.amount}
          onChange={e => setQty(Math.max(1, Math.min(item.amount, Number(e.target.value))))} />
        <button className="btn btn-outline-secondary" onClick={() => setQty(Math.min(item.amount, qty + 1))} type="button">+</button>
      </div>
      <button className="btn btn-dark btn-modern text-uppercase" onClick={handleAdd} disabled={adding} style={{ minWidth: 180 }}>
        {adding ? "Adding…" : added ? "✓ Added!" : "Add to Cart"}
      </button>
      {added && <Link href="/cart" className="btn btn-outline-dark btn-modern text-uppercase">View Cart</Link>}
    </div>
  );
}
