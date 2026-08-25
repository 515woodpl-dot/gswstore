"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import type { Category } from "@/types";

interface Row {
  id: string; name: string; category_id: number | null; category_name: string;
  brand: string | null; model_number: string | null; voltage: string | null;
  sku: string | null; description: string | null; amount: number;
  store_price: number; sale_price: number | null; cost_price: number; image_url: string | null; images: string[] | null;
  featured: boolean; new_arrival: boolean; store_visible: boolean;
  attributes: Record<string, string> | null;
  tax_enabled: boolean; tax_rate_percent: number;
  parent_id: string | null; variant_label: string; variant_dimension: string; part_number: string;
}

const PRODUCT_ATTR_FIELDS = [
  "Material", "Installation", "Surface Finishing", "Feature", "Design Style",
  "Application", "Shape", "Warranty", "After-sale Service",
  "Bath Hardware Set Finishing", "Project Solution Capability",
  "Type", "Place of Origin", "Brand Name", "Model Number",
  "Main Material", "Single package size", "Single gross weight",
];

const BLANK: Row = {
  id: "", name: "", category_id: null, category_name: "", brand: "", model_number: "",
  voltage: "", sku: "", description: "", amount: 0, store_price: 0, sale_price: null, cost_price: 0, image_url: "", images: [], featured: false, new_arrival: false, store_visible: true,
  attributes: {}, tax_enabled: false, tax_rate_percent: 0,
  parent_id: null, variant_label: "", variant_dimension: "Color", part_number: "",
};

// Compress image to max 1200px wide and ~80% quality JPEG using Canvas
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Compression failed")), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export default function InventoryManager({ initialItems, categories }: { initialItems: Row[]; categories: Category[] }) {
  const [items, setItems]       = useState<Row[]>(initialItems);
  const [editing, setEditing]   = useState<Row | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [search, setSearch]     = useState("");
  const mainImgRef  = useRef<HTMLInputElement>(null);
  const galleryRef  = useRef<HTMLInputElement>(null);
  const sb = createClient();

  const [originalId, setOriginalId] = useState<string | null>(null);
  function startNew() { setEditing({ ...BLANK }); setOriginalId(null); setError(""); }
  function startEdit(row: Row) { setEditing({ ...row }); setOriginalId(row.id); setError(""); }

  // ── Auto-SKU generation ──────────────────────────────────────────────────
  // Regular product: <CATEGORY_PREFIX>-<next 4-digit sequence>  e.g. CTR-0001
  // Variant:         <PARENT_SKU><first letters of variant label> e.g. SILW
  function generateSku(row: Row): string {
    // Variant SKU — derive from parent SKU + variant label
    if (row.parent_id) {
      const parent = items.find((p) => p.id === row.parent_id);
      const base = (parent?.sku || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const labelPart = (row.variant_label || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
      if (base) return `${base}${labelPart}`;
    }
    // Regular product SKU — category prefix + next sequence
    const cat = categories.find((c) => c.id === row.category_id);
    const prefix = (cat?.prefix || "GEN").toUpperCase();
    const existing = items
      .filter((p) => p.sku?.startsWith(`${prefix}-`))
      .map((p) => parseInt(p.sku!.split("-")[1], 10))
      .filter((n) => !isNaN(n));
    const next = (existing.length ? Math.max(...existing) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  function autoFillSku() {
    if (!editing) return;
    setEditing({ ...editing, sku: generateSku(editing) });
  }

  async function uploadImage(file: File): Promise<string> {
    setUploadProgress(`Compressing ${file.name}…`);
    const compressed = await compressImage(file);
    const sizeBefore = (file.size / 1024).toFixed(0);
    const sizeAfter  = (compressed.size / 1024).toFixed(0);
    console.log(`[Image] ${file.name}: ${sizeBefore}KB → ${sizeAfter}KB`);

    setUploadProgress(`Uploading…`);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: upErr } = await sb.storage.from("inventory-images").upload(path, compressed, {
      contentType: "image/jpeg", upsert: true,
    });
    if (upErr) throw new Error(upErr.message);
    const { data } = sb.storage.from("inventory-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleMainImage(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editing || !e.target.files?.[0]) return;
    setUploading(true); setError("");
    try {
      const url = await uploadImage(e.target.files[0]);
      setEditing(prev => prev ? { ...prev, image_url: url } : prev);
    } catch (err) { setError(String(err)); }
    setUploading(false); setUploadProgress("");
    e.target.value = "";
  }

  async function handleGalleryImages(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editing || !e.target.files?.length) return;
    setUploading(true); setError("");
    try {
      const files = Array.from(e.target.files);
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Image ${i + 1} of ${files.length}…`);
        urls.push(await uploadImage(files[i]));
      }
      setEditing(prev => prev ? { ...prev, images: [...(prev.images ?? []), ...urls] } : prev);
    } catch (err) { setError(String(err)); }
    setUploading(false); setUploadProgress("");
    e.target.value = "";
  }

  async function save() {
    if (!editing) return;
    if (!editing.id.trim() || !editing.name.trim()) { setError("ID and name are required."); return; }
    setSaving(true); setError("");
    // Auto-generate SKU if left blank
    const editingWithSku = editing.sku?.trim() ? editing : { ...editing, sku: generateSku(editing) };
    const cat = categories.find((c) => c.id === editingWithSku.category_id);
    const payload: Row = {
      ...editingWithSku,
      id: editing.id.trim(), name: editing.name.trim(),
      category_name: cat?.name ?? editing.category_name ?? "",
      brand: editing.brand ?? "", model_number: editing.model_number ?? "",
      voltage: editing.voltage ?? "", sku: editingWithSku.sku ?? "",
      description: editing.description ?? "",
      amount: Number(editing.amount) || 0, store_price: Number(editing.store_price) || 0, sale_price: editing.sale_price ? Number(editing.sale_price) : null, cost_price: Number(editing.cost_price) || 0,
      image_url: editing.image_url || null, images: editing.images ?? [],
      featured: editing.featured ?? false,
      new_arrival: editing.new_arrival ?? false,
      attributes: editing.attributes ?? {},
      tax_enabled: editing.tax_enabled ?? false,
      tax_rate_percent: Number(editing.tax_rate_percent) || 0,
      parent_id: editing.parent_id?.trim() || null,
      variant_label: editing.variant_label ?? "",
      variant_dimension: editing.variant_dimension || "Color",
      part_number: editing.part_number ?? "",
    };
    let err = null as { message: string } | null;
    if (originalId) {
      const { error: e } = await sb.from("inventory").update(payload).eq("id", originalId);
      err = e;
    } else {
      const { error: e } = await sb.from("inventory").insert(payload);
      err = e;
    }
    if (err) { setError(err.message); setSaving(false); return; }
    setItems((prev) => {
      const withoutOld = originalId ? prev.filter((p) => p.id !== originalId) : prev;
      const exists = withoutOld.some((p) => p.id === payload.id);
      return exists ? withoutOld.map((p) => (p.id === payload.id ? payload : p)) : [...withoutOld, payload];
    });
    // Bust the storefront cache so Staff Picks / featured changes show immediately.
    fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
    setEditing(null); setOriginalId(null); setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
    const { error: err } = await sb.from("inventory").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function stockBadge(n: number) {
    if (n <= 0) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Out</span>;
    if (n < 10) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Low ({n})</span>;
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">In ({n})</span>;
  }

  const filtered = search
    ? items.filter(i => [i.name, i.id, i.sku, i.category_name].join(" ").toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-600">{filtered.length} of {items.length} products</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-navy w-48" />
        </div>
        <div className="flex gap-2">
          <a href="/admin/receiving" className="rounded-xl border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy hover:bg-brand-navy/5">
            Receive Stock
          </a>
          <button onClick={startNew} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 shrink-0">
            + Add Product
          </button>
        </div>
      </div>

      {error && !editing && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Visible</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  {row.image_url
                    ? <img src={row.image_url} alt={row.name} className="h-10 w-10 rounded-lg object-cover" />
                    : <div className="h-10 w-10 rounded-lg bg-slate-100" />}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {row.name}
                    {row.featured && <span className="ml-1.5 text-xs">⭐</span>}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{row.id}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.category_name}</td>
                <td className="px-4 py-3 font-semibold">{formatPrice(row.store_price)}</td>
                <td className="px-4 py-3">{stockBadge(row.amount)}</td>
                <td className="px-4 py-3">{row.store_visible ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(row)} className="mr-3 text-sm font-semibold text-brand-navy hover:underline">Edit</button>
                  <button onClick={() => remove(row.id)} className="text-sm font-semibold text-rose-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">No products found.</p>
        )}
        {filtered.map((row) => (
          <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              {row.image_url
                ? <img src={row.image_url} alt={row.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                : <div className="h-14 w-14 rounded-xl bg-slate-100 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{row.name}</p>
                <p className="text-xs font-mono text-slate-400">{row.id}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-brand-navy">{formatPrice(row.store_price)}</span>
                  {stockBadge(row.amount)}
                  {!row.store_visible && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Hidden</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <button onClick={() => startEdit(row)} className="flex-1 rounded-xl border border-brand-navy px-3 py-2 text-sm font-semibold text-brand-navy">Edit</button>
              <button onClick={() => remove(row.id)} className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / New modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-0 sm:p-4" onClick={() => !saving && !uploading && setEditing(null)}>
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-2xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <h2 className="mb-5 text-lg font-black text-slate-950">{items.some((i) => i.id === editing.id) ? "Edit" : "New"} Product</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID *" value={editing.id} onChange={(v) => setEditing({ ...editing, id: v })} placeholder="P001" mono />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">SKU</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editing.sku ?? ""}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    placeholder="Auto or manual"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono" />
                  <button
                    type="button"
                    onClick={autoFillSku}
                    title="Auto-generate SKU"
                    className="shrink-0 rounded-xl border border-brand-navy px-3 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5">
                    Auto
                  </button>
                </div>
              </label>
              <div className="sm:col-span-2">
                <Field label="Name *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              </div>

              {/* Variant configuration */}
              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-sm font-bold text-slate-900">Variant Settings</p>
                <p className="mb-3 text-xs text-slate-500">
                  Leave &quot;Parent product&quot; empty for a normal/standalone product. To make this a variant (e.g. a color of silicone), pick its parent product below — it will then appear as a selectable option on the parent&apos;s page instead of in the catalog.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Parent product</span>
                    <select
                      value={editing.parent_id ?? ""}
                      onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                      <option value="">— none (standalone product) —</option>
                      {items.filter((p) => !p.parent_id && p.id !== editing.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </label>
                  {editing.parent_id && (
                    <>
                      <Field label="Variant label (e.g. Clear)" value={editing.variant_label ?? ""} onChange={(v) => setEditing({ ...editing, variant_label: v })} />
                      <Field label="Dimension (e.g. Color)" value={editing.variant_dimension ?? "Color"} onChange={(v) => setEditing({ ...editing, variant_dimension: v })} />
                    </>
                  )}
                  <Field label="Part #" value={editing.part_number ?? ""} onChange={(v) => setEditing({ ...editing, part_number: v })} />
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Category</span>
                <select value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <Field label="Brand" value={editing.brand ?? ""} onChange={(v) => setEditing({ ...editing, brand: v })} />
              <Field label="Model #" value={editing.model_number ?? ""} onChange={(v) => setEditing({ ...editing, model_number: v })} />
              <Field label="Voltage" value={editing.voltage ?? ""} onChange={(v) => setEditing({ ...editing, voltage: v })} />
              <Field label="Regular Price ($)" type="number" value={String(editing.store_price)} onChange={(v) => setEditing({ ...editing, store_price: Number(v) })} />
              <Field label="Sale Price ($)" type="number" value={String(editing.sale_price ?? "")} onChange={(v) => setEditing({ ...editing, sale_price: v ? Number(v) : null })} placeholder="Leave empty if no sale" />
              <Field label="Average Landed Cost ($)" type="number" value={String(editing.cost_price || "")} onChange={(v) => setEditing({ ...editing, cost_price: Number(v) || 0 })} placeholder="Updated automatically by receiving" />
              <Field label="Stock amount" type="number" value={String(editing.amount)} onChange={(v) => setEditing({ ...editing, amount: Number(v) })} />
              <p className="-mt-2 text-xs leading-5 text-slate-400 sm:col-span-2">
                For normal deliveries, use Receive Stock so quantity and true landed cost update together. These fields remain editable for corrections.
              </p>

              {/* Tax controls */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Tax</span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={editing.tax_enabled}
                      onChange={(e) => setEditing({ ...editing, tax_enabled: e.target.checked })} className="h-4 w-4 rounded" />
                    <span className="text-sm font-semibold text-slate-700">Apply tax to this item</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Rate (%)</span>
                    <input type="number" step="0.01" value={String(editing.tax_rate_percent ?? 0)}
                      disabled={!editing.tax_enabled}
                      onChange={(e) => setEditing({ ...editing, tax_rate_percent: Number(e.target.value) })}
                      className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" placeholder="e.g. 8.5" />
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-400">When on, the product page shows the price plus this tax. Turn off to display price without added tax.</p>
              </div>

              {/* Key Attributes editor */}
              <div className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Product Attributes</span>
                <p className="mb-3 text-xs text-slate-400">Fill in any fields that apply. Leave blank to hide. Shown in the Key Attributes block on the product page.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PRODUCT_ATTR_FIELDS.map((field) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">{field}</span>
                      <input
                        type="text"
                        value={(editing.attributes ?? {})[field] ?? ""}
                        onChange={(e) => {
                          const attrs = { ...(editing.attributes ?? {}) };
                          if (e.target.value.trim()) { attrs[field] = e.target.value; }
                          else { delete attrs[field]; }
                          setEditing({ ...editing, attributes: attrs });
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">Custom attributes</p>
                  <div className="space-y-2">
                    {Object.entries(editing.attributes ?? {}).filter(([k]) => !PRODUCT_ATTR_FIELDS.includes(k)).map(([k, v], i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={k} placeholder="Label"
                          onChange={(e) => {
                            const custom = Object.entries(editing.attributes ?? {}).filter(([key]) => !PRODUCT_ATTR_FIELDS.includes(key));
                            const preset = Object.fromEntries(Object.entries(editing.attributes ?? {}).filter(([key]) => PRODUCT_ATTR_FIELDS.includes(key)));
                            custom[i] = [e.target.value, v];
                            setEditing({ ...editing, attributes: { ...preset, ...Object.fromEntries(custom) } });
                          }}
                          className="w-1/3 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <input value={v} placeholder="Value"
                          onChange={(e) => {
                            const custom = Object.entries(editing.attributes ?? {}).filter(([key]) => !PRODUCT_ATTR_FIELDS.includes(key));
                            const preset = Object.fromEntries(Object.entries(editing.attributes ?? {}).filter(([key]) => PRODUCT_ATTR_FIELDS.includes(key)));
                            custom[i] = [k, e.target.value];
                            setEditing({ ...editing, attributes: { ...preset, ...Object.fromEntries(custom) } });
                          }}
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <button type="button"
                          onClick={() => {
                            const custom = Object.entries(editing.attributes ?? {}).filter(([key]) => !PRODUCT_ATTR_FIELDS.includes(key)).filter((_, j) => j !== i);
                            const preset = Object.fromEntries(Object.entries(editing.attributes ?? {}).filter(([key]) => PRODUCT_ATTR_FIELDS.includes(key)));
                            setEditing({ ...editing, attributes: { ...preset, ...Object.fromEntries(custom) } });
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => {
                      const custom = Object.entries(editing.attributes ?? {}).filter(([k]) => !PRODUCT_ATTR_FIELDS.includes(k));
                      const preset = Object.fromEntries(Object.entries(editing.attributes ?? {}).filter(([k]) => PRODUCT_ATTR_FIELDS.includes(k)));
                      setEditing({ ...editing, attributes: { ...preset, ...Object.fromEntries([...custom, ["", ""]]) } });
                    }}
                    className="mt-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-navy hover:text-brand-navy">
                    + Add custom attribute
                  </button>
                </div>
              </div>

              {/* Main image upload */}
              <div className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Main Image</span>
                <div className="flex items-start gap-3">
                  {editing.image_url && (
                    <div className="relative shrink-0">
                      <img src={editing.image_url} alt="preview" className="h-20 w-20 rounded-xl object-cover border border-slate-200" />
                      <button onClick={() => setEditing({ ...editing, image_url: "" })}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white shadow">✕</button>
                    </div>
                  )}
                  <button onClick={() => mainImgRef.current?.click()} disabled={uploading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-brand-navy hover:text-brand-navy disabled:opacity-50">
                    {uploading && uploadProgress.includes("Compress") ? <span className="animate-pulse">{uploadProgress}</span> : "📷 Upload Image"}
                  </button>
                  <input ref={mainImgRef} type="file" accept="image/*" className="hidden" onChange={handleMainImage} />
                </div>
                <p className="mt-1 text-xs text-slate-400">Auto-compressed to web size before uploading.</p>
              </div>

              {/* Gallery images */}
              <div className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Gallery Images</span>
                {(editing.images ?? []).length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(editing.images ?? []).map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="h-16 w-16 rounded-xl object-cover border border-slate-200" />
                        <button onClick={() => setEditing({ ...editing, images: editing.images?.filter((_, j) => j !== i) ?? null })}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white shadow">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => galleryRef.current?.click()} disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-navy hover:text-brand-navy disabled:opacity-50">
                  {uploading && uploadProgress ? <span className="animate-pulse">{uploadProgress}</span> : "🖼️ Add Gallery Images (select multiple)"}
                </button>
                <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryImages} />
              </div>

              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">Description</span>
                  <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <label className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={editing.store_visible} onChange={(e) => setEditing({ ...editing, store_visible: e.target.checked })} className="h-4 w-4 rounded" />
                <span className="text-sm font-semibold text-slate-700">Visible in store</span>
              </label>
              <label className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="h-4 w-4 rounded" />
                <span className="text-sm font-semibold text-slate-700">⭐ Staff Pick <span className="font-normal text-slate-400">(shows in Staff Picks section on homepage)</span></span>
              </label>
              <label className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={editing.new_arrival} onChange={(e) => setEditing({ ...editing, new_arrival: e.target.checked })} className="h-4 w-4 rounded" />
                <span className="text-sm font-semibold text-slate-700">New Arrival (homepage section)</span>
              </label>
            </div>

            {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditing(null)} disabled={saving || uploading}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:flex-none sm:px-5">Cancel</button>
              <button onClick={save} disabled={saving || uploading}
                className="flex-1 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70 sm:flex-none">
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
        className={`w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm ${mono ? "font-mono" : ""}`} />
    </label>
  );
}
