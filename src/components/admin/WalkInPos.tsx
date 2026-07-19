"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

function genOrderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
  return `GSW-${d}-${r}`;
}

interface PosLine {
  item: InventoryItem;
  qty: number;
}

export default function WalkInPos() {
  const sb = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneOrder, setDoneOrder] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("inventory")
        .select("id,name,sku,brand,category_name,amount,store_price,sale_price,image_url")
        .gt("amount", 0)
        .order("name");
      if (data) setItems(data as unknown as InventoryItem[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? "").toLowerCase().includes(q) ||
          (i.brand ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, items]);

  const total = lines.reduce((s, l) => s + (l.item.sale_price ?? l.item.store_price) * l.qty, 0);

  function addLine(item: InventoryItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.amount) return prev; // can't exceed stock
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1 }];
    });
    setQuery("");
  }

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === id ? { ...l, qty: Math.max(0, Math.min(qty, l.item.amount)) } : l))
        .filter((l) => l.qty > 0)
    );
  }

  async function completeSale() {
    setError("");
    if (lines.length === 0) { setError("Add at least one product."); return; }
    if (!custEmail.trim() || !custEmail.includes("@")) { setError("Enter the customer's email."); return; }
    if (!custName.trim()) { setError("Enter the customer's name."); return; }

    setSaving(true);
    try {
      // 1. Upsert walk-in customer by email
      const { data: cust, error: custErr } = await sb
        .from("walk_in_customers")
        .upsert({ email: custEmail.trim().toLowerCase(), name: custName.trim() }, { onConflict: "email" })
        .select("id")
        .single();
      if (custErr || !cust) throw new Error(custErr?.message || "Failed to save customer");

      // 2. Create completed walk-in order
      const { data: order, error: orderErr } = await sb
        .from("orders")
        .insert({
          order_number: genOrderNumber(),
          user_id: null,
          status: "completed",
          total,
          notes: "",
          source: "walk_in",
          walk_in_customer_id: cust.id,
          fulfillment: "pickup",
        })
        .select("id,order_number")
        .single();
      if (orderErr || !order) throw new Error(orderErr?.message || "Failed to create order");

      // 3. Insert order items
      const orderItems = lines.map((l) => ({
        order_id: order.id,
        item_id: l.item.id,
        name: l.item.name,
        sku: l.item.sku,
        image_url: l.item.image_url,
        unit_price: l.item.sale_price ?? l.item.store_price,
        quantity: l.qty,
      }));
      const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
      if (itemsErr) throw new Error(itemsErr.message);

      // 4. Decrement inventory
      await Promise.all(
        lines.map((l) => sb.rpc("decrement_inventory", { p_item_id: l.item.id, p_qty: l.qty }))
      );

      setDoneOrder(order.order_number);
      setLines([]);
      setCustName("");
      setCustEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setSaving(false);
    }
  }

  if (doneOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
          <p className="text-4xl">✅</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">Sale completed</h1>
          <p className="mt-2 text-sm text-slate-600">Order <span className="font-mono font-bold">{doneOrder}</span> recorded and inventory updated.</p>
          <button
            onClick={() => setDoneOrder(null)}
            className="mt-6 rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            New Walk-in Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Walk-in Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">Ring up an in-store sale. Order is recorded as completed and stock is decremented.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: search + lines */}
        <div className="space-y-4">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name, SKU, or brand…"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-navy"
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addLine(r)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{r.name}</span>
                      <span className="block text-xs text-slate-500">{r.sku} · {r.amount} in stock</span>
                    </span>
                    <span className="text-sm font-bold text-slate-900">{formatPrice(r.sale_price ?? r.store_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
              Search above and click a product to add it to the sale.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {lines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.item.name}</p>
                    <p className="text-xs text-slate-500">{formatPrice(l.item.sale_price ?? l.item.store_price)} each · {l.item.amount} in stock</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(l.item.id, l.qty - 1)} className="h-8 w-8 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">−</button>
                    <input
                      type="number"
                      value={l.qty}
                      onChange={(e) => setQty(l.item.id, Number(e.target.value))}
                      className="h-8 w-14 rounded-lg border border-slate-200 text-center text-sm"
                    />
                    <button onClick={() => setQty(l.item.id, l.qty + 1)} className="h-8 w-8 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">+</button>
                  </div>
                  <p className="w-20 text-right text-sm font-bold text-slate-900">
                    {formatPrice((l.item.sale_price ?? l.item.store_price) * l.qty)}
                  </p>
                  <button onClick={() => setQty(l.item.id, 0)} className="text-rose-500 hover:text-rose-700">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: customer + total */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-950">Customer</h2>
            <p className="mt-0.5 text-xs text-slate-500">Saved for purchase history, newsletter, and future discounts.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Name</span>
              <input value={custName} onChange={(e) => setCustName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-navy" placeholder="Customer name" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Email</span>
              <input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-navy" placeholder="customer@email.com" />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Items</span>
              <span className="text-sm font-semibold">{lines.reduce((s, l) => s + l.qty, 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-base font-bold text-slate-950">Total</span>
              <span className="text-2xl font-black text-slate-950">{formatPrice(total)}</span>
            </div>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <button
              onClick={completeSale}
              disabled={saving || lines.length === 0}
              className="mt-4 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Recording sale…" : "Complete Sale"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Payment is taken at the register — this records the sale.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
