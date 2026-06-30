"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import type { Category } from "@/types";

interface Row {
  id: string; name: string; category_id: number | null; category_name: string;
  brand: string | null; model_number: string | null; voltage: string | null;
  sku: string | null; description: string | null; amount: number;
  store_price: number; sale_price: number | null; image_url: string | null; images: string[] | null;
  featured: boolean; new_arrival: boolean; store_visible: boolean;
}

const BLANK: Row = {
  id: "", name: "", category_id: null, category_name: "", brand: "", model_number: "",
  voltage: "", sku: "", description: "", amount: 0, store_price: 0, sale_price: null, image_url: "", images: [], featured: false, new_arrival: false, store_visible: true,
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

  function startNew() { setEditing({ ...BLANK }); setError(""); }
  function startEdit(row: Row) { setEditing({ ...row }); setError(""); }

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
    const cat = categories.find((c) => c.id === editing.category_id);
    const payload: Row = {
      ...editing,
      id: editing.id.trim(), name: editing.name.trim(),
      category_name: cat?.name ?? editing.category_name ?? "",
      brand: editing.brand ?? "", model_number: editing.model_number ?? "",
      voltage: editing.voltage ?? "", sku: editing.sku ?? "",
      description: editing.description ?? "",
      amount: Number(editing.amount) || 0, store_price: Number(editing.store_price) || 0, sale_price: editing.sale_price ? Number(editing.sale_price) : null,
      image_url: editing.image_url || null, images: editing.images ?? [], new_arrival: editing.new_arrival ?? false,
    };
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
        <button onClick={startNew} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 shrink-0">
          + Add Product
        </button>
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
                  <p className="font-medium text-slate-900">{row.name}</p>
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
              <Field label="SKU" value={editing.sku ?? ""} onChange={(v) => setEditing({ ...editing, sku: v })} />
              <div className="sm:col-span-2">
                <Field label="Name *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
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
              <Field label="Stock amount" type="number" value={String(editing.amount)} onChange={(v) => setEditing({ ...editing, amount: Number(v) })} />

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
                <span className="text-sm font-semibold text-slate-700">Featured (homepage slideshow)</span>
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
