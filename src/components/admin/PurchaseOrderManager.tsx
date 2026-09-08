"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";

interface Supplier { id: string; name: string; contact_name: string; email: string; phone: string; notes: string; }
interface InvItem { id: string; name: string; sku: string; cost_price: number; store_price: number; }
interface POItem { id: string; po_id: string; item_id: string | null; item_name: string; quantity: number; unit_cost: number; landed_cost: number; }
interface PO {
  id: string; po_number: string; supplier_id: string | null; supplier_name: string;
  status: string; freight: number; tariffs: number; handling: number;
  subtotal: number; landed_total: number; notes: string;
  ordered_at: string | null; received_at: string | null; received_by: string;
  created_at: string; po_items: POItem[];
}

type View = "list" | "new" | "detail";

function generatePONumber() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${date}-${rand}`;
}

export default function PurchaseOrderManager({
  initialPOs, initialSuppliers, inventoryItems,
}: {
  initialPOs: PO[]; initialSuppliers: Supplier[]; inventoryItems: InvItem[];
}) {
  const sb = createClient();
  const [view, setView] = useState<View>("list");
  const [pos, setPOs] = useState<PO[]>(initialPOs);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receiveMsg, setReceiveMsg] = useState("");

  // New PO state
  const [poNumber, setPONumber] = useState(generatePONumber());
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [freight, setFreight] = useState(0);
  const [tariffs, setTariffs] = useState(0);
  const [handling, setHandling] = useState(0);
  const [poNotes, setPONotes] = useState("");
  const [lines, setLines] = useState<{ item_id: string; item_name: string; quantity: number; unit_cost: number }[]>([]);

  function addLine() {
    setLines([...lines, { item_id: "", item_name: "", quantity: 1, unit_cost: 0 }]);
  }
  function updateLine(idx: number, field: string, value: string | number) {
    setLines(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function selectItem(idx: number, itemId: string) {
    const inv = inventoryItems.find((i) => i.id === itemId);
    if (!inv) return;
    setLines(lines.map((l, i) => i === idx ? { ...l, item_id: inv.id, item_name: inv.name, unit_cost: inv.cost_price || 0 } : l));
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const extras = freight + tariffs + handling;
  const landedTotal = subtotal + extras;

  function selectSupplier(id: string) {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    setSupplierName(s?.name || "");
  }

  async function createSupplier() {
    if (!newSupplierName.trim()) return;
    const { data, error: e } = await sb.from("suppliers").insert({ name: newSupplierName.trim() }).select().single();
    if (e || !data) { setError(e?.message || "Failed"); return; }
    setSuppliers([...suppliers, data as Supplier]);
    setSupplierId(data.id);
    setSupplierName(data.name);
    setNewSupplierName("");
  }

  async function savePO() {
    if (lines.length === 0) { setError("Add at least one item."); return; }
    if (!supplierName.trim()) { setError("Select or create a supplier."); return; }
    setSaving(true); setError("");
    try {
      const { data: po, error: e1 } = await sb.from("purchase_orders").insert({
        po_number: poNumber,
        supplier_id: supplierId || null,
        supplier_name: supplierName,
        status: "ordered",
        freight, tariffs, handling,
        subtotal,
        landed_total: landedTotal,
        notes: poNotes,
        ordered_at: new Date().toISOString(),
      }).select().single();
      if (e1 || !po) throw new Error(e1?.message || "Failed to create PO");

      const poItems = lines.map((l) => ({
        po_id: po.id,
        item_id: l.item_id || null,
        item_name: l.item_name,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        landed_cost: 0,
      }));
      const { error: e2 } = await sb.from("po_items").insert(poItems);
      if (e2) throw new Error(e2.message);

      const { data: fullPO } = await sb.from("purchase_orders").select("*, po_items(*)").eq("id", po.id).single();
      if (fullPO) setPOs([fullPO as PO, ...pos]);
      resetForm();
      setView("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  }

  function resetForm() {
    setPONumber(generatePONumber());
    setSupplierId(""); setSupplierName(""); setNewSupplierName("");
    setFreight(0); setTariffs(0); setHandling(0); setPONotes("");
    setLines([]);
    setError("");
  }

  async function receivePO(po: PO) {
    if (!confirm(`Receive PO ${po.po_number}?\n\nThis will:\n• Update cost prices on all items\n• Add quantities to stock\n• Send a receiving notification email`)) return;
    setSaving(true); setError(""); setReceiveMsg("");
    try {
      const poSubtotal = po.po_items.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
      const poExtras = Number(po.freight) + Number(po.tariffs) + Number(po.handling);

      // Allocate extras proportionally by line value
      for (const line of po.po_items) {
        const lineValue = line.quantity * line.unit_cost;
        const share = poSubtotal > 0 ? lineValue / poSubtotal : 1 / po.po_items.length;
        const allocatedExtra = poExtras * share;
        const landedPerUnit = line.unit_cost + (line.quantity > 0 ? allocatedExtra / line.quantity : 0);

        // Update landed_cost on po_item
        await sb.from("po_items").update({ landed_cost: Math.round(landedPerUnit * 100) / 100 }).eq("id", line.id);

        // Update inventory cost_price and add stock
        if (line.item_id) {
          const { data: inv } = await sb.from("inventory").select("amount,cost_price").eq("id", line.item_id).single();
          if (inv) {
            await sb.from("inventory").update({
              cost_price: Math.round(landedPerUnit * 100) / 100,
              amount: Number(inv.amount) + line.quantity,
            }).eq("id", line.item_id);
          }
        }
      }

      // Mark PO received
      await sb.from("purchase_orders").update({
        status: "received",
        received_at: new Date().toISOString(),
        subtotal: poSubtotal,
        landed_total: poSubtotal + poExtras,
      }).eq("id", po.id);

      // Send receiving notification email
      try {
        await fetch("/api/purchase-orders/receive-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poId: po.id }),
        });
      } catch { /* email is best-effort */ }

      // Refresh PO list
      const { data: updated } = await sb.from("purchase_orders").select("*, po_items(*)").eq("id", po.id).single();
      if (updated) {
        setPOs((prev) => prev.map((p) => p.id === po.id ? (updated as PO) : p));
        setSelectedPO(updated as PO);
      }
      setReceiveMsg("✓ Stock updated, cost prices set.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to receive");
    } finally { setSaving(false); }
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        <div className="mb-4 flex gap-3">
          <button onClick={() => { resetForm(); setView("new"); }}
            className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            + New Purchase Order
          </button>
        </div>

        {pos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">
            No purchase orders yet. Create one to track inbound shipments and landed costs.
          </div>
        ) : (
          <div className="space-y-3">
            {pos.map((po) => (
              <article key={po.id}
                onClick={() => { setSelectedPO(po); setView("detail"); setReceiveMsg(""); }}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-gold transition">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{po.po_number}</p>
                    <p className="text-xs text-slate-500">{po.supplier_name} · {new Date(po.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      po.status === "received" ? "bg-emerald-100 text-emerald-700" :
                      po.status === "ordered" ? "bg-blue-100 text-blue-700" :
                      po.status === "cancelled" ? "bg-slate-100 text-slate-500" :
                      "bg-amber-100 text-amber-700"
                    }`}>{po.status}</span>
                    <span className="font-black text-slate-950">{formatPrice(Number(po.landed_total) || Number(po.subtotal))}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (view === "detail" && selectedPO) {
    const po = selectedPO;
    const poExtras = Number(po.freight) + Number(po.tariffs) + Number(po.handling);
    return (
      <div>
        <button onClick={() => { setView("list"); setError(""); }}
          className="mb-4 text-sm font-semibold text-slate-600 hover:text-slate-900">← Back to list</button>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">{po.po_number}</h2>
              <p className="text-sm text-slate-500">{po.supplier_name}</p>
              {po.ordered_at && <p className="text-xs text-slate-400">Ordered: {new Date(po.ordered_at).toLocaleDateString()}</p>}
              {po.received_at && <p className="text-xs text-emerald-600 font-semibold">Received: {new Date(po.received_at).toLocaleDateString()}</p>}
            </div>
            <span className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${
              po.status === "received" ? "bg-emerald-100 text-emerald-700" :
              po.status === "ordered" ? "bg-blue-100 text-blue-700" :
              "bg-amber-100 text-amber-700"
            }`}>{po.status}</span>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4 text-center">Qty</th>
                  <th className="pb-2 pr-4 text-right">Unit Cost</th>
                  <th className="pb-2 text-right">Line Total</th>
                  {po.status === "received" && <th className="pb-2 text-right">Landed/Unit</th>}
                </tr>
              </thead>
              <tbody>
                {po.po_items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{item.item_name}</td>
                    <td className="py-2 pr-4 text-center">{item.quantity}</td>
                    <td className="py-2 pr-4 text-right">{formatPrice(item.unit_cost)}</td>
                    <td className="py-2 text-right">{formatPrice(item.quantity * item.unit_cost)}</td>
                    {po.status === "received" && (
                      <td className="py-2 text-right font-semibold text-emerald-700">{formatPrice(item.landed_cost)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cost summary */}
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{formatPrice(Number(po.subtotal))}</span></div>
            {Number(po.freight) > 0 && <div className="flex justify-between"><span className="text-slate-500">Freight</span><span>{formatPrice(Number(po.freight))}</span></div>}
            {Number(po.tariffs) > 0 && <div className="flex justify-between"><span className="text-slate-500">Tariffs</span><span>{formatPrice(Number(po.tariffs))}</span></div>}
            {Number(po.handling) > 0 && <div className="flex justify-between"><span className="text-slate-500">Handling</span><span>{formatPrice(Number(po.handling))}</span></div>}
            {poExtras > 0 && (
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-950">
                <span>Landed Total</span><span>{formatPrice(Number(po.landed_total))}</span>
              </div>
            )}
          </div>

          {po.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{po.notes}</p>}

          {/* Receive button */}
          {po.status === "ordered" && (
            <div className="mt-5">
              <button onClick={() => receivePO(po)} disabled={saving}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Processing…" : "📦 Receive Shipment"}
              </button>
              <p className="mt-1 text-xs text-slate-400">Updates cost prices, adds stock, sends notification.</p>
            </div>
          )}

          {receiveMsg && <p className="mt-3 text-sm font-semibold text-emerald-600">{receiveMsg}</p>}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    );
  }

  // ── NEW PO FORM ─────────────────────────────────────────────────────────────
  return (
    <div>
      <button onClick={() => { setView("list"); setError(""); }}
        className="mb-4 text-sm font-semibold text-slate-600 hover:text-slate-900">← Back to list</button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-5 text-xl font-black text-slate-950">New Purchase Order</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">PO Number</span>
            <input type="text" value={poNumber} onChange={(e) => setPONumber(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Supplier</span>
            <select value={supplierId} onChange={(e) => selectSupplier(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Or add new supplier…" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <button onClick={createSupplier} disabled={!newSupplierName.trim()}
                className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40">Add</button>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Items</span>
            <button onClick={addLine} className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">+ Add Item</button>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              No items yet. Click &quot;Add Item&quot; to start.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Product</label>
                    <select value={line.item_id} onChange={(e) => selectItem(idx, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">— Select —</option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>{inv.name} {inv.sku ? `(${inv.sku})` : ""}</option>
                      ))}
                    </select>
                    {!line.item_id && (
                      <input type="text" value={line.item_name} onChange={(e) => updateLine(idx, "item_name", e.target.value)}
                        placeholder="Or type item name" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Qty</label>
                    <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", Number(e.target.value) || 1)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Unit Cost ($)</label>
                    <input type="number" step="0.01" min="0" value={line.unit_cost || ""} onChange={(e) => updateLine(idx, "unit_cost", Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right" />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Line Total</label>
                    <p className="py-1.5 text-sm font-bold text-slate-900">{formatPrice(line.quantity * line.unit_cost)}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={() => removeLine(idx)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extra costs */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Freight / Shipping ($)</span>
            <input type="number" step="0.01" min="0" value={freight || ""} onChange={(e) => setFreight(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Tariffs / Duties ($)</span>
            <input type="number" step="0.01" min="0" value={tariffs || ""} onChange={(e) => setTariffs(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Handling / Other ($)</span>
            <input type="number" step="0.01" min="0" value={handling || ""} onChange={(e) => setHandling(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>

        {/* Totals */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Items subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
          {extras > 0 && <div className="flex justify-between"><span className="text-slate-500">Freight + tariffs + handling</span><span>{formatPrice(extras)}</span></div>}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-black text-slate-950">
            <span>Landed Total</span><span>{formatPrice(landedTotal)}</span>
          </div>
          {lines.length > 0 && subtotal > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Extra costs allocated by value: each item gets a share of freight/tariffs/handling proportional to its line total.
            </p>
          )}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Notes</span>
          <textarea value={poNotes} onChange={(e) => setPONotes(e.target.value)} rows={2} placeholder="Tracking number, delivery notes, etc."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={() => { setView("list"); setError(""); }} disabled={saving}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button>
          <button onClick={savePO} disabled={saving || lines.length === 0}
            className="rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Saving…" : "Save Purchase Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
