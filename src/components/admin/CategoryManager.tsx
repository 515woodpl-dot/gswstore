"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

const BLANK: Omit<Category, "id"> = { name: "", prefix: "", color: "#435d69" };

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [cats, setCats]     = useState<Category[]>(initialCategories);
  const [editing, setEditing] = useState<(Category & { isNew?: boolean }) | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const sb = createClient();

  function startNew() { setEditing({ id: 0, ...BLANK, isNew: true }); setError(""); }
  function startEdit(c: Category) { setEditing({ ...c }); setError(""); }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { setError("Name is required."); return; }
    if (!editing.prefix.trim()) { setError("Prefix is required (used for order numbers)."); return; }
    setSaving(true); setError("");

    if (editing.isNew) {
      const { data, error: err } = await sb
        .from("categories")
        .insert({ name: editing.name.trim(), prefix: editing.prefix.trim().toUpperCase(), color: editing.color })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setCats(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      const { error: err } = await sb
        .from("categories")
        .update({ name: editing.name.trim(), prefix: editing.prefix.trim().toUpperCase(), color: editing.color })
        .eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
      setCats(prev => prev.map(c => c.id === editing.id ? { ...c, name: editing.name, prefix: editing.prefix.toUpperCase(), color: editing.color } : c));
    }

    setEditing(null); setSaving(false);
  }

  async function remove(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? Items in this category will be uncategorized.`)) return;
    const { error: err } = await sb.from("categories").delete().eq("id", cat.id);
    if (err) { setError(err.message); return; }
    setCats(prev => prev.filter(c => c.id !== cat.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Categories</h2>
          <p className="text-sm text-slate-500 mt-0.5">{cats.length} categories</p>
        </div>
        <button onClick={startNew}
          className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          + New Category
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Category list */}
      <div className="space-y-2">
        {cats.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">No categories yet.</p>
        )}
        {cats.map(cat => (
          <div key={cat.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 rounded-full shrink-0" style={{ background: cat.color }} />
              <div>
                <span className="font-semibold text-slate-900">{cat.name}</span>
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">{cat.prefix}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(cat)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-navy hover:text-brand-navy">
                Edit
              </button>
              <button onClick={() => remove(cat)}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / New modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-5 text-lg font-black text-slate-900">
              {editing.isNew ? "New Category" : `Edit — ${editing.name}`}
            </h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Category Name</span>
                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Power Tools"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Prefix <span className="font-normal text-slate-400">(used in order/item codes)</span>
                </span>
                <input type="text" value={editing.prefix} maxLength={6}
                  onChange={e => setEditing({ ...editing, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. PWR"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono uppercase" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Color</span>
                <div className="flex items-center gap-3">
                  <input type="color" value={editing.color}
                    onChange={e => setEditing({ ...editing, color: e.target.value })}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 p-1" />
                  <span className="font-mono text-sm text-slate-500">{editing.color}</span>
                </div>
              </label>
            </div>
            {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setEditing(null); setError(""); }} disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={save} disabled={saving}
                className="rounded-xl bg-brand-navy px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
