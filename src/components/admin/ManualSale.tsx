"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { baseUnitsForSale } from "@/lib/packaging";
import { useAuth } from "@/hooks/useAuth";
import type { InventoryItem } from "@/types";

function genOrderNumber(dateStr: string) {
  const d = dateStr.replace(/-/g, "");
  const r = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
  return `GSW-${d}-M${r.slice(0, 5)}`;
}

interface Line {
  key: string;
  itemId: string | null; // null = free-text item not in catalog
  name: string;
  sku: string;
  listPrice: number;
  soldPrice: number;
  qty: number;
  decrementStock: boolean;
  unitsPerSale?: number;
}

export default function ManualSale() {
  const sb = createClient();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // Sale metadata
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleTime, setSaleTime] = useState("12:00");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneOrder, setDoneOrder] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("inventory")
        .select("id,name,sku,brand,category_name,amount,store_price,sale_price,image_url,base_unit,selling_unit,units_per_sale")
        .order("name");
      if (data) setItems(data as unknown as InventoryItem[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q) || (i.brand ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, items]);

  const total = lines.reduce((s, l) => s + l.soldPrice * l.qty, 0);
  const listTotal = lines.reduce((s, l) => s + l.listPrice * l.qty, 0);
  const discountTotal = Math.max(0, listTotal - total);

  function addCatalogLine(item: InventoryItem) {
    const base = item.sale_price ?? item.store_price;
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), itemId: item.id, name: item.name, sku: item.sku ?? "", listPrice: base, soldPrice: base, qty: 1, decrementStock: false, unitsPerSale: item.units_per_sale ?? 1 },
    ]);
    setQuery("");
  }

  function addBlankLine() {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), itemId: null, name: "", sku: "", listPrice: 0, soldPrice: 0, qty: 1, decrementStock: false },
    ]);
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function save() {
    setError("");
    if (lines.length === 0) { setError("Add at least one item."); return; }
    if (lines.some((l) => !l.name.trim())) { setError("Every line needs an item name."); return; }
    if (!saleDate) { setError("Enter the sale date."); return; }
    if (discountTotal > 0 && !discountReason.trim()) { setError("A discount was applied — enter a reason."); return; }

    setSaving(true);
    try {
      // Compose backdated timestamp
      const createdAt = new Date(`${saleDate}T${saleTime || "12:00"}:00`).toISOString();

      // Optional walk-in customer
      let customerId: string | null = null;
      if (custEmail.trim() && custEmail.includes("@")) {
        const { data: cust } = await sb
          .from("walk_in_customers")
          .upsert({ email: custEmail.trim().toLowerCase(), name: custName.trim() || custEmail.trim() }, { onConflict: "email" })
          .select("id")
          .single();
        customerId = cust?.id ?? null;
      }

      const soldByName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.email ? user.email.split("@")[0] : "Staff");

      const { data: order, error: orderErr } = await sb
        .from("orders")
        .insert({
          order_number: genOrderNumber(saleDate),
          user_id: null,
          status: "completed",
          total,
          notes: "",
          source: "manual",
          walk_in_customer_id: customerId,
          fulfillment: "pickup",
          sold_by_id: user?.id ?? null,
          sold_by_name: soldByName,
          discount_total: discountTotal,
          manual_note: manualNote.trim(),
          created_at: createdAt,
        })
        .select("id,order_number")
        .single();
      if (orderErr || !order) throw new Error(orderErr?.message || "Failed to create sale");

      const orderItems = lines.map((l) => ({
        order_id: order.id,
        item_id: l.itemId ?? `manual-${l.key.slice(0, 8)}`,
        name: l.name.trim(),
        sku: l.sku.trim() || null,
        image_url: null,
        unit_price: l.soldPrice,
        list_price: l.listPrice || l.soldPrice,
        cost_price: 0,
        discount_amount: Math.max(0, (l.listPrice - l.soldPrice) * l.qty),
        discount_reason: (l.listPrice - l.soldPrice) > 0 ? discountReason.trim() : "",
        quantity: l.qty,
        base_units_per_sale: l.unitsPerSale ?? 1,
      }));
      const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
      if (itemsErr) throw new Error(itemsErr.message);

      // Only decrement stock where explicitly requested (catalog items still on shelf)
      await Promise.all(
        lines
          .filter((l) => l.itemId && l.decrementStock)
          .map((l) => sb.rpc("decrement_inventory", { p_item_id: l.itemId!, p_qty: baseUnitsForSale(l.qty, l.unitsPerSale) }))
      );

      setDoneOrder(order.order_number);

      // Email a receipt if a customer email was provided (fire-and-forget).
      if (customerId) {
        fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        }).catch(() => {});
      }
      setLines([]); setCustName(""); setCustEmail(""); setManualNote(""); setDiscountReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save sale");
    } finally {
      setSaving(false);
    }
  }

  if (doneOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
          <p className="text-4xl">✅</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">Past sale recorded</h1>
          <p className="mt-2 text-sm text-slate-600">Order <span className="font-mono font-bold">{doneOrder}</span> added to your records.</p>
          <button onClick={() => setDoneOrder(null)} className="mt-6 rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white hover:bg-slate-800">
            Add Another Past Sale
          </button>
        </div>
      </div>
    );
  }

  const inputCls = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Add a Past Sale</h1>
      <p className="mt-1 text-sm text-slate-500">
        Record a sale that happened offline (power outage, no internet, handwritten). Backdate it to the real date so your reports and QuickBooks export stay accurate.
      </p>

      {/* Date + note */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">Sale date</span>
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={`w-full ${inputCls}`} max={new Date().toISOString().slice(0, 10)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">Time (approx)</span>
          <input type="time" value={saleTime} onChange={(e) => setSaleTime(e.target.value)} className={`w-full ${inputCls}`} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-800">Why is this being entered manually? (optional)</span>
        <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} className={`w-full ${inputCls}`} placeholder="e.g. Power outage 3/14, written on paper receipt #42" />
      </label>

      {/* Search */}
      <div className="relative mt-6">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog to add an item…" className={`w-full ${inputCls}`} />
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <button key={r.id} onClick={() => addCatalogLine(r)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{r.name}</span>
                  <span className="block text-xs text-slate-500">{r.sku}</span>
                </span>
                <span className="text-sm font-bold text-slate-900">{formatPrice(r.sale_price ?? r.store_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={addBlankLine} className="mt-2 text-sm font-semibold text-brand-navy hover:underline">
        + Add an item not in catalog
      </button>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="mt-4 space-y-2">
          {lines.map((l) => {
            const lineDiscount = (l.listPrice - l.soldPrice) * l.qty;
            return (
              <div key={l.key} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <div className="space-y-2">
                    <input value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Item name" className={`w-full ${inputCls}`} />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <input value={l.sku} onChange={(e) => update(l.key, { sku: e.target.value })} placeholder="SKU (optional)" className={`w-32 ${inputCls}`} />
                      <label className="flex items-center gap-1">
                        <span className="text-slate-500">Qty</span>
                        <input type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(1, Number(e.target.value)) })} className={`w-16 ${inputCls}`} />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-slate-500">List $</span>
                        <input type="number" step="0.01" value={l.listPrice} onChange={(e) => update(l.key, { listPrice: Number(e.target.value) })} className={`w-20 ${inputCls}`} />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-slate-500">Sold $</span>
                        <input type="number" step="0.01" value={l.soldPrice} onChange={(e) => update(l.key, { soldPrice: Number(e.target.value) })} className={`w-20 ${inputCls} ${lineDiscount > 0 ? "border-amber-300 bg-amber-50" : ""}`} />
                      </label>
                      {l.itemId && (
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={l.decrementStock} onChange={(e) => update(l.key, { decrementStock: e.target.checked })} />
                          <span className="text-slate-500">Reduce stock</span>
                        </label>
                      )}
                    </div>
                    {lineDiscount > 0 && <p className="text-xs font-semibold text-amber-700">−{formatPrice(lineDiscount)} discount</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatPrice(l.soldPrice * l.qty)}</p>
                    <button onClick={() => remove(l.key)} className="mt-1 text-xs text-rose-500 hover:text-rose-700">Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer + totals */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name (optional)" className={`w-full ${inputCls}`} />
        <input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="Customer email (optional)" className={`w-full ${inputCls}`} />
      </div>

      {discountTotal > 0 && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-amber-800">Discount reason (required)</span>
          <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none" placeholder="e.g. Contractor pricing, cash discount" />
        </label>
      )}

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          {discountTotal > 0 && <p className="text-sm text-slate-500 line-through">{formatPrice(listTotal)}</p>}
          <p className="text-2xl font-black text-slate-950">{formatPrice(total)}</p>
        </div>
        <button onClick={save} disabled={saving || lines.length === 0} className="rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? "Saving…" : "Record Past Sale"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
