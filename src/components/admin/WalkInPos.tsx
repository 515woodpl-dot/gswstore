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
  const [doneData, setDoneData] = useState<{
    orderNumber: string; lines: PosLine[]; custName: string;
    custEmail: string; total: number; discountTotal: number;
    discountReason: string; soldBy: string; date: string;
    taxRate: number; taxAmount: number;
  } | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [applyTax, setApplyTax] = useState(true);

  // Fetch store ZIP and its tax rate on mount
  useEffect(() => {
    (async () => {
      try {
        const settingsRes = await fetch("/api/admin/tax-rates?zip=store");
        // Get store ZIP from settings then look up rate
        const sbClient = createClient();
        const { data: settings } = await sbClient
          .from("store_settings")
          .select("value")
          .eq("key", "store_zip")
          .single();
        if (settings?.value) {
          const rateRes = await fetch(`/api/admin/tax-rates?zip=${settings.value}`);
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            if (rateData.combined_rate) setTaxRate(Number(rateData.combined_rate));
          }
        }
      } catch { /* no tax rate available, default 0 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const taxAmount = applyTax && taxRate > 0 ? Math.round(total * taxRate * 100) / 100 : 0;
  const grandTotal = total + taxAmount;

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
    if (!custEmail.trim() || !custEmail.includes("@")) { setError("Enter the customer's email."); return; }
    if (!custName.trim()) { setError("Enter the customer's name."); return; }
    if (discountTotal > 0 && !discountReason.trim()) {
      setError("A discount was applied — please enter a reason.");
      return;
    }

    setSaving(true);
    try {
      const { data: cust, error: custErr } = await sb
        .from("walk_in_customers")
        .upsert({ email: custEmail.trim().toLowerCase(), name: custName.trim() }, { onConflict: "email" })
        .select("id")
        .single();
      if (custErr || !cust) throw new Error(custErr?.message || "Failed to save customer");

      const soldByName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.email ? user.email.split("@")[0] : "Staff");

      const { data: order, error: orderErr } = await sb
        .from("orders")
        .insert({
          order_number: genOrderNumber(),
          user_id: null,
          status: "completed",
          total: grandTotal,
          notes: taxRate > 0 ? `Tax (${(taxRate * 100).toFixed(2)}%): ${formatPrice(taxAmount)}` : "",
          source: "walk_in",
          walk_in_customer_id: cust.id,
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

      setDoneOrder(order.order_number);
      setDoneData({
        orderNumber: order.order_number,
        lines: [...lines],
        custName: custName.trim(),
        custEmail: custEmail.trim(),
        total: grandTotal,
        discountTotal,
        discountReason: discountReason.trim(),
        soldBy: soldByName,
        date: new Date().toLocaleString(),
        taxRate,
        taxAmount,
      });
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

  if (doneOrder && doneData) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        {/* Print-only receipt — hidden on screen, shown when printing */}
        <div id="gsw-receipt" className="hidden print:block font-mono text-[13px] text-black">
          <div className="text-center">
            <p className="text-lg font-bold">Stone Product Supply</p>
            <p className="text-xs">stoneproductsupply.com</p>
            <p className="mt-1 text-xs">================================</p>
            <p className="font-bold">RECEIPT</p>
            <p className="text-xs">{doneData.orderNumber}</p>
            <p className="text-xs">{doneData.date}</p>
            {doneData.soldBy && <p className="text-xs">Served by: {doneData.soldBy}</p>}
            <p className="text-xs">================================</p>
          </div>
          <div className="mt-2 space-y-1">
            {doneData.lines.map((l, i) => (
              <div key={i}>
                <p className="font-semibold">{l.item.name}</p>
                <div className="flex justify-between text-xs">
                  <span>{l.qty} × ${l.soldPrice.toFixed(2)}</span>
                  <span>${(l.soldPrice * l.qty).toFixed(2)}</span>
                </div>
                {l.listPrice > l.soldPrice && (
                  <p className="text-xs">  Discount: -${((l.listPrice - l.soldPrice) * l.qty).toFixed(2)}{doneData.discountReason ? ` (${doneData.discountReason})` : ""}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 text-center">
            <p className="text-xs">--------------------------------</p>
            {doneData.discountTotal > 0 && (
              <div className="flex justify-between"><span>You saved:</span><span>-${doneData.discountTotal.toFixed(2)}</span></div>
            )}
            {doneData.taxAmount > 0 && (
              <div className="flex justify-between text-xs"><span>Tax ({(doneData.taxRate * 100).toFixed(2)}%):</span><span>${doneData.taxAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-[15px]">
              <span>TOTAL</span>
              <span>${doneData.total.toFixed(2)}</span>
            </div>
            <p className="text-xs">================================</p>
            {doneData.custName && <p className="text-xs">Customer: {doneData.custName}</p>}
            {doneData.custEmail && <p className="text-xs">Email receipt: {doneData.custEmail}</p>}
            <p className="mt-2 text-xs">Thank you for shopping with us!</p>
            <p className="text-xs">Stone Product Supply</p>
          </div>
        </div>

        {/* Screen view */}
        <div className="print:hidden">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 text-2xl font-black text-slate-950">Sale completed</h1>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-mono font-bold">{doneData.orderNumber}</span> · {doneData.date}
            </p>
            {doneData.custEmail && (
              <p className="mt-2 text-xs text-emerald-700">📧 Receipt emailed to {doneData.custEmail}</p>
            )}
          </div>

          {/* Receipt preview */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <div className="divide-y divide-slate-100">
              {doneData.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{l.item.name}</p>
                    <p className="text-xs text-slate-500">{l.qty} × {l.soldPrice !== l.listPrice ? <><span className="line-through text-slate-400">${l.listPrice.toFixed(2)}</span> ${l.soldPrice.toFixed(2)}</> : `$${l.soldPrice.toFixed(2)}`}</p>
                  </div>
                  <span className="font-bold">${(l.soldPrice * l.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {doneData.discountTotal > 0 && (
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm text-amber-700">
                <span>Total savings</span><span>−${doneData.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-950">
              <span>Total</span><span>${doneData.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              🖨 Print receipt
            </button>
            <button
              onClick={() => { setDoneOrder(null); setDoneData(null); }}
              className="flex-1 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              New Sale
            </button>
          </div>
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
            {taxRate > 0 && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-navy"
                  />
                  <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
                </label>
                <span className="font-semibold">{applyTax ? formatPrice(taxAmount) : "—"}</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-base font-bold text-slate-950">Total</span>
              <span className="text-2xl font-black text-slate-950">{formatPrice(grandTotal)}</span>
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
