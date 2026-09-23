"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

interface Line {
  item: InventoryItem;
  qty: number;
  listPrice: number;
  lineDiscount: number; // dollars, applied to the whole line (not per-unit)
}

export default function AdminPaymentOrderBuilder() {
  const sb = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  const [taxRate, setTaxRate] = useState(0);
  const [applyTax, setApplyTax] = useState(true);
  const [zip, setZip] = useState("");
  const [taxLoading, setTaxLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ orderNumber: string; total: number; paymentLinkUrl: string; emailSent: boolean; testMode: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("inventory")
        .select("id,name,sku,brand,category_name,amount,store_price,sale_price,cost_price,image_url,base_unit,selling_unit,units_per_sale")
        .gt("amount", 0)
        .order("name");
      if (data) setItems(data as unknown as InventoryItem[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupTax(z: string) {
    setZip(z);
    const clean = z.trim();
    if (clean.length !== 5 || !/^\d{5}$/.test(clean)) { setTaxRate(0); return; }
    setTaxLoading(true);
    try {
      const res = await fetch(`/api/admin/tax-rates?zip=${clean}`);
      if (res.ok) { const d = await res.json(); setTaxRate(Number(d.combined_rate) || 0); }
    } catch { /* leave tax rate as-is */ }
    setTaxLoading(false);
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q) || (i.brand ?? "").toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query, items]);

  function addLine(item: InventoryItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.amount) return prev;
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      const base = item.sale_price ?? item.store_price;
      return [...prev, { item, qty: 1, listPrice: base, lineDiscount: 0 }];
    });
    setQuery("");
  }

  function setQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.item.id === id ? { ...l, qty: Math.max(0, Math.min(qty, l.item.amount)) } : l)).filter((l) => l.qty > 0));
  }
  function setLineDiscount(id: string, val: number) {
    setLines((prev) => prev.map((l) => (l.item.id === id ? { ...l, lineDiscount: Math.max(0, val) } : l)));
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.item.id !== id));
  }

  // ── Live preview totals (server recomputes authoritatively on submit) ────
  const subtotal = lines.reduce((s, l) => s + l.listPrice * l.qty, 0);
  const lineDiscounts = lines.reduce((s, l) => s + Math.min(l.lineDiscount, l.listPrice * l.qty), 0);
  const afterLineDiscount = subtotal - lineDiscounts;
  const orderDiscount = discountType === "percent"
    ? Math.round(afterLineDiscount * (Math.min(100, Math.max(0, discountValue)) / 100) * 100) / 100
    : discountType === "fixed" ? Math.min(afterLineDiscount, Math.max(0, discountValue)) : 0;
  const taxable = Math.max(0, afterLineDiscount - orderDiscount);
  const taxAmount = applyTax ? Math.round(taxable * taxRate * 100) / 100 : 0;
  const total = taxable + taxAmount;
  const totalDiscount = lineDiscounts + orderDiscount;

  async function submit() {
    setError("");
    if (lines.length === 0) { setError("Add at least one product."); return; }
    if (!custName.trim()) { setError("Enter the customer's name."); return; }
    if (!custEmail.trim() || !custEmail.includes("@")) { setError("Enter a valid customer email."); return; }
    if (totalDiscount > 0 && !discountReason.trim()) { setError("A discount was applied — please enter a reason."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/payment-link/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: custName.trim(),
          customerEmail: custEmail.trim(),
          customerPhone: custPhone.trim(),
          customerNotes: customerNotes.trim(),
          internalNotes: internalNotes.trim(),
          requestKey,
          testMode,
          applyTax,
          taxZip: zip,
          discount: discountType ? { type: discountType, value: discountValue } : undefined,
          discountReason: discountReason.trim(),
          lines: lines.map((l) => ({ itemId: l.item.id, quantity: l.qty, lineDiscount: l.lineDiscount })),
        }),
      });
      const responseText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
      } catch {
        setError(
          res.ok
            ? "The server returned an invalid response. Please contact support."
            : `The server could not complete the request (HTTP ${res.status}). Check the deployment logs and try again.`,
        );
        setSaving(false);
        return;
      }
      if (!res.ok || data.ok === false) {
        setError(typeof data.error === "string" ? data.error : "Could not create the order.");
        setSaving(false);
        return;
      }
      if (typeof data.orderNumber !== "string" || typeof data.total !== "number" || typeof data.paymentLinkUrl !== "string") {
        setError("The server response was incomplete. Check the deployment logs before trying again.");
        setSaving(false);
        return;
      }
      setResult({
        orderNumber: data.orderNumber,
        total: data.total,
        paymentLinkUrl: data.paymentLinkUrl,
        emailSent: data.emailSent !== false,
        testMode: data.testMode === true,
      });
    } catch (requestError) {
      setError(requestError instanceof Error
        ? `Could not reach the server: ${requestError.message}`
        : "Could not reach the server. Check your connection and try again.");
    }
    setSaving(false);
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
        <div className={`rounded-3xl border p-8 ${result.testMode ? "border-violet-200 bg-violet-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className={`text-sm font-semibold uppercase tracking-widest ${result.testMode ? "text-violet-700" : "text-emerald-700"}`}>{result.testMode ? "Test order created" : "Payment link sent"}</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{result.orderNumber}</h1>
          <p className="mt-2 text-slate-700">
            {result.testMode
              ? `${formatPrice(result.total)} Sandbox order created. Inventory is reserved and ${result.emailSent ? "the test payment link was emailed." : "the payment link was created, but email delivery failed."} Delete the test order from Orders when testing is complete.`
              : `${formatPrice(result.total)} due — ${result.emailSent ? "the customer has been emailed a secure payment link." : "the payment link was created, but email delivery failed. Copy the link now or resend it from Orders."}`}
          </p>
          <a href={result.paymentLinkUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-brand-navy underline">
            {result.testMode ? "Open the Square Sandbox payment page →" : "View the payment page →"}
          </a>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/admin/orders" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">Go to Orders</Link>
            <button onClick={() => { setResult(null); setRequestKey(crypto.randomUUID()); setLines([]); setCustName(""); setCustEmail(""); setCustPhone(""); setCustomerNotes(""); setInternalNotes(""); setDiscountType(""); setDiscountValue(0); setDiscountReason(""); }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Admin</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">New Payment-Link Order</h1>
        <p className="mt-1 text-sm text-slate-500">Build the order, then send the customer a secure Square payment link by email.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {/* Product search */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Add Products</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU, or brand…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            {results.length > 0 && (
              <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {results.map((item) => (
                  <button key={item.id} onClick={() => addLine(item)} type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span className="min-w-0 truncate font-medium text-slate-900">{item.name}</span>
                    <span className="shrink-0 text-slate-500">{formatPrice(item.sale_price ?? item.store_price)} · {item.amount} in stock</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Line items */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Items ({lines.length})</label>
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No products added yet.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => (
                  <div key={l.item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{l.item.name}</p>
                      <button onClick={() => removeLine(l.item.id)} className="text-xs font-semibold text-rose-600">Remove</button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <label className="block">
                        <span className="mb-0.5 block text-slate-500">Qty</span>
                        <input type="number" min={1} max={l.item.amount} value={l.qty}
                          onChange={(e) => setQty(l.item.id, Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5" />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-slate-500">Unit Price</span>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">{formatPrice(l.listPrice)}</div>
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-slate-500">Line Discount ($)</span>
                        <input type="number" min={0} step="0.01" value={l.lineDiscount}
                          onChange={(e) => setLineDiscount(l.item.id, Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5" />
                      </label>
                    </div>
                    <p className="mt-1 text-right text-xs font-semibold text-slate-600">
                      {formatPrice(Math.max(0, l.listPrice * l.qty - l.lineDiscount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Customer</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Full name"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="Email" type="email"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone (optional)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Customer-Facing Note</label>
            <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2}
              placeholder="Shown to the customer in the payment email." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <label className="mb-1 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Internal Note (staff only)</label>
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
              placeholder="Never shown to the customer." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </section>
        </div>

        {/* Summary / discount / tax / submit */}
        <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <label className={`block cursor-pointer rounded-xl border p-3 ${testMode ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} /> Test mode
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">Runs the complete workflow through Square Sandbox: reserves inventory, emails the link, and supports fulfillment. Delete the test order afterward to restore inventory and remove its records.</span>
          </label>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Order Discount</label>
            <div className="flex gap-2">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "" | "percent" | "fixed")} className="rounded-xl border border-slate-300 px-2 py-2 text-sm">
                <option value="">None</option>
                <option value="percent">Percent %</option>
                <option value="fixed">Fixed $</option>
              </select>
              {discountType && (
                <input type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-300 px-2 py-2 text-sm" />
              )}
            </div>
            {totalDiscount > 0 && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-semibold text-amber-800">Discount reason (required)</span>
                <input value={discountReason} onChange={(e) => { setDiscountReason(e.target.value); setError(""); }} placeholder="e.g. Contractor pricing"
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm" />
              </label>
            )}
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} /> Apply Sales Tax
            </label>
            {applyTax && (
              <div className="flex items-center gap-2">
                <input value={zip} onChange={(e) => lookupTax(e.target.value)} placeholder="ZIP" maxLength={5}
                  className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <span className="text-xs text-slate-500">{taxLoading ? "Looking up…" : taxRate > 0 ? `${(taxRate * 100).toFixed(2)}%` : "No rate found"}</span>
              </div>
            )}
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {totalDiscount > 0 && <div className="flex justify-between text-amber-700"><span>Discount</span><span>−{formatPrice(totalDiscount)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between text-slate-600"><span>Tax</span><span>{formatPrice(taxAmount)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-950"><span>Total</span><span>{formatPrice(total)}</span></div>
          </div>

          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}

          <button onClick={submit} disabled={saving}
            className="w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? (testMode ? "Creating Test…" : "Sending…") : (testMode ? "Create Test Order" : "Send Payment Link")}
          </button>
        </aside>
      </div>
    </div>
  );
}
