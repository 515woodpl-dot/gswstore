"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { InventoryItem } from "@/types";

function genOrderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
  return `GSW-${d}-${r}`;
}

interface PosLine {
  item: InventoryItem;
  qty: number;
  listPrice: number;   // original catalog price (per unit)
  soldPrice: number;   // actual price charged (per unit, editable)
}

export default function WalkInPos() {
  const sb = createClient();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [discountReason, setDiscountReason] = useState("");
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

  const total = lines.reduce((s, l) => s + l.soldPrice * l.qty, 0);
  const listTotal = lines.reduce((s, l) => s + l.listPrice * l.qty, 0);
  const discountTotal = Math.max(0, listTotal - total);

  function addLine(item: InventoryItem) {
    const base = item.sale_price ?? item.store_price;
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.amount) return prev;
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1, listPrice: base, soldPrice: base }];
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

  function setPrice(id: string, price: number) {
    setLines((prev) =>
      prev.map((l) => (l.item.id === id ? { ...l, soldPrice: Math.max(0, price) } : l))
    );
  }

  async function completeSale() {
    setError("");
    if (lines.length === 0) { setError("Add at least one product."); return; }
    if (custEmail.trim() && !custEmail.includes("@")) { setError("That email doesn't look valid."); return; }
    if (discountTotal > 0 && !discountReason.trim()) {
      setError("A discount was applied — please enter a reason.");
      return;
    }

    setSaving(true);
    try {
      // Only create/link a customer record if an email was provided.
      let customerId: string | null = null;
      if (custEmail.trim() && custEmail.includes("@")) {
        const { data: cust, error: custErr } = await sb
          .from("walk_in_customers")
          .upsert({ email: custEmail.trim().toLowerCase(), name: custName.trim() || custEmail.trim() }, { onConflict: "email" })
          .select("id")
          .single();
        if (custErr) throw new Error(custErr.message || "Failed to save customer");
        customerId = cust?.id ?? null;
      }

      const soldByName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.email ? user.email.split("@")[0] : "Staff");

      const { data: order, error: orderErr } = await sb
        .from("orders")
        .insert({
          order_number: genOrderNumber(),
          user_id: null,
          status: "completed",
          total,
          notes: "",
          source: "walk_in",
          walk_in_customer_id: customerId,
          fulfillment: "pickup",
          sold_by_id: user?.id ?? null,
          sold_by_name: soldByName,
          discount_total: discountTotal,
        })
        .select("id,order_number")
        .single();
      if (orderErr || !order) throw new Error(orderErr?.message || "Failed to create order");

      const orderItems = lines.map((l) => ({
        order_id: order.id,
        item_id: l.item.id,
        name: l.item.name,
        sku: l.item.sku,
        image_url: l.item.image_url,
        unit_price: l.soldPrice,
        list_price: l.listPrice,
        discount_amount: Math.max(0, (l.listPrice - l.soldPrice) * l.qty),
        discount_reason: (l.listPrice - l.soldPrice) > 0 ? discountReason.trim() : "",
        quantity: l.qty,
      }));
      const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
      if (itemsErr) throw new Error(itemsErr.message);

      await Promise.all(
        lines.map((l) => sb.rpc("decrement_inventory", { p_item_id: l.item.id, p_qty: l.qty }))
      );

      // Email a receipt if the customer left an email (fire-and-forget).
      if (customerId) {
        fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        }).catch(() => {});
      }

      setDoneOrder(order.order_number);
      setLines([]);
      setCustName("");
      setCustEmail("");
      setDiscountReason("");
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
          <button onClick={() => setDoneOrder(null)}
            className="mt-6 rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white hover:bg-slate-800">
            New Walk-in Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Walk-in Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">Ring up an in-store sale. Prices are editable. Order is recorded as completed and stock is decremented.</p>

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
                  <button key={r.id} onClick={() => addLine(r)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
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
              {lines.map((l) => {
                const lineDiscount = (l.listPrice - l.soldPrice) * l.qty;
                return (
                  <div key={l.item.id} className="border-b border-slate-100 px-4 py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{l.item.name}</p>
                        <p className="text-xs text-slate-500">List {formatPrice(l.listPrice)} · {l.item.amount} in stock</p>
                      </div>
                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.item.id, l.qty - 1)} className="h-8 w-8 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">−</button>
                        <input type="number" value={l.qty} onChange={(e) => setQty(l.item.id, Number(e.target.value))}
                          className="h-8 w-12 rounded-lg border border-slate-200 text-center text-sm" />
                        <button onClick={() => setQty(l.item.id, l.qty + 1)} className="h-8 w-8 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">+</button>
                      </div>
                      {/* Editable unit price */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">$</span>
                        <input type="number" step="0.01" value={l.soldPrice}
                          onChange={(e) => setPrice(l.item.id, Number(e.target.value))}
                          className={`h-8 w-20 rounded-lg border text-right text-sm ${lineDiscount > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`} />
                      </div>
                      <p className="w-20 text-right text-sm font-bold text-slate-900">{formatPrice(l.soldPrice * l.qty)}</p>
                      <button onClick={() => setQty(l.item.id, 0)} className="text-rose-500 hover:text-rose-700">✕</button>
                    </div>
                    {lineDiscount > 0 && (
                      <p className="mt-1 text-right text-xs font-semibold text-amber-700">
                        −{formatPrice(lineDiscount)} discount ({Math.round((lineDiscount / (l.listPrice * l.qty)) * 100)}% off)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: customer + total */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-950">Customer</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Optional</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Add an email to send a receipt and save for marketing. Leave blank for a quick anonymous sale.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Name</span>
              <input value={custName} onChange={(e) => setCustName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-navy" placeholder="Customer name (optional)" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Email</span>
              <input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-navy" placeholder="customer@email.com (optional)" />
              {custEmail.trim() && custEmail.includes("@") && (
                <span className="mt-1 block text-xs text-emerald-600">✓ A receipt will be emailed to this address.</span>
              )}
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Items</span>
              <span className="font-semibold">{lines.reduce((s, l) => s + l.qty, 0)}</span>
            </div>
            {discountTotal > 0 && (
              <>
                <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                  <span>List total</span>
                  <span className="line-through">{formatPrice(listTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold text-amber-700">
                  <span>Total discount</span>
                  <span>−{formatPrice(discountTotal)}</span>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-semibold text-amber-800">Discount reason (required)</span>
                  <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none"
                    placeholder="e.g. Contractor discount, damaged box, loyalty" />
                </label>
              </>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-base font-bold text-slate-950">Total</span>
              <span className="text-2xl font-black text-slate-950">{formatPrice(total)}</span>
            </div>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <button onClick={completeSale} disabled={saving || lines.length === 0}
              className="mt-4 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              {saving ? "Recording sale…" : "Complete Sale"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Payment is taken at the register — this records the sale.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
