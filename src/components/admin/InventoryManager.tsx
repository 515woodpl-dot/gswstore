"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import type { Category } from "@/types";

interface Row {
  id: string;
  name: string;
  category_id: number | null;
  category_name: string;
  brand: string | null;
  model_number: string | null;
  voltage: string | null;
  sku: string | null;
  description: string | null;
  amount: number;
  store_price: number;
  image_url: string | null;
  store_visible: boolean;
}

const BLANK: Row = {
  id: "", name: "", category_id: null, category_name: "", brand: "", model_number: "",
  voltage: "", sku: "", description: "", amount: 0, store_price: 0, image_url: "", store_visible: true,
};

export default function InventoryManager({ initialItems, categories }: { initialItems: Row[]; categories: Category[] }) {
  const [items, setItems] = useState<Row[]>(initialItems);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sb = createClient();

  function startNew() { setEditing({ ...BLANK }); setError(""); }
  function startEdit(row: Row) { setEditing({ ...row }); setError(""); }

  async function save() {
    if (!editing) return;
    if (!editing.id.trim() || !editing.name.trim()) { setError("ID and name are required."); return; }
    setSaving(true); setError("");
    const cat = categories.find((c) => c.id === editing.category_id);
    const payload = { ...editing, category_name: cat?.name ?? editing.category_name ?? "" };
    const { error: err } = await sb.from("inventory").upsert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setItems((prev) => {
      const exists = prev.some((p) => p.id === payload.id);
      return exists ? prev.map((p) => (p.id === payload.id ? payload : p)) : [...prev, payload];
    });
    setEditing(null); setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
    const { error: err } = await sb.from("inventory").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function stockLabel(n: number) {
    if (n <= 0) return <span className="text-rose-600">Out</span>;
    if (n < 10) return <span className="text-amber-600">Low ({n})</span>;
    return <span className="text-emerald-600">In ({n})</span>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">{items.length} products</p>
        <button onClick={startNew} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          + Add Product
        </button>
      </div>

      {error && !editing && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th><th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th><th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th><th className="px-4 py-3">Visible</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.category_name}</td>
                <td className="px-4 py-3">{formatPrice(row.store_price)}</td>
                <td className="px-4 py-3">{stockLabel(row.amount)}</td>
                <td className="px-4 py-3">{row.store_visible ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(row)} className="mr-3 text-sm font-semibold text-brand-navy hover:underline">Edit</button>
                  <button onClick={() => remove(row.id)} className="text-sm font-semibold text-rose-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No products yet. Add your first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-slate-950">{items.some((i) => i.id === editing.id) ? "Edit" : "New"} Product</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID *" value={editing.id} onChange={(v) => setEditing({ ...editing, id: v })} placeholder="P001" mono />
              <Field label="SKU" value={editing.sku ?? ""} onChange={(v) => setEditing({ ...editing, sku: v })} />
              <div className="sm:col-span-2">
                <Field label="Name *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Category</span>
                <select value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <Field label="Brand" value={editing.brand ?? ""} onChange={(v) => setEditing({ ...editing, brand: v })} />
              <Field label="Model #" value={editing.model_number ?? ""} onChange={(v) => setEditing({ ...editing, model_number: v })} />
              <Field label="Voltage" value={editing.voltage ?? ""} onChange={(v) => setEditing({ ...editing, voltage: v })} />
              <Field label="Price" type="number" value={String(editing.store_price)} onChange={(v) => setEditing({ ...editing, store_price: Number(v) })} />
              <Field label="Stock amount" type="number" value={String(editing.amount)} onChange={(v) => setEditing({ ...editing, amount: Number(v) })} />
              <div className="sm:col-span-2">
                <Field label="Image URL" value={editing.image_url ?? ""} onChange={(v) => setEditing({ ...editing, image_url: v })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">Description</span>
                  <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={editing.store_visible} onChange={(e) => setEditing({ ...editing, store_visible: e.target.checked })} />
                <span className="text-sm font-semibold text-slate-700">Visible in store</span>
              </label>
            </div>
            {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-brand-navy px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-sm ${mono ? "font-mono" : ""}`} />
    </label>
  );
}
