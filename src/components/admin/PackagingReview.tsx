"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SupplyUnitField from "@/components/admin/SupplyUnitField";

interface PackagingRow {
  id: string;
  name: string;
  sku: string | null;
  category_name: string;
  amount: number;
  base_unit: string;
  selling_unit: string;
  units_per_sale: number;
  packaging_reviewed: boolean;
  parent_id: string | null;
}

interface Draft {
  baseUnit: string;
  sellingUnit: string;
  unitsPerSale: string;
}

function makeDraft(row: PackagingRow): Draft {
  return {
    baseUnit: row.base_unit || "Each",
    sellingUnit: row.selling_unit || "Each",
    unitsPerSale: String(row.units_per_sale || 1),
  };
}

export default function PackagingReview({ initialItems }: { initialItems: PackagingRow[] }) {
  const sb = createClient();
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialItems.map((row) => [row.id, makeDraft(row)]))
  );
  const [filter, setFilter] = useState<"unreviewed" | "all">("unreviewed");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const unreviewedCount = items.filter((item) => !item.packaging_reviewed).length;
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "unreviewed" && item.packaging_reviewed) return false;
      return !query || [item.name, item.id, item.sku ?? "", item.category_name].join(" ").toLowerCase().includes(query);
    });
  }, [filter, items, search]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function save(row: PackagingRow) {
    const draft = drafts[row.id] ?? makeDraft(row);
    const factor = Number(draft.unitsPerSale);
    if (!Number.isInteger(factor) || factor < 1) {
      setError({ id: row.id, message: "Base units per sale must be a whole number of 1 or more." });
      return;
    }
    if (!draft.baseUnit.trim() || !draft.sellingUnit.trim() || draft.baseUnit === "__custom__" || draft.sellingUnit === "__custom__") {
      setError({ id: row.id, message: "Enter both the base stock unit and customer selling unit." });
      return;
    }

    setSavingId(row.id);
    setError(null);
    const { error: rpcError } = await sb.rpc("review_inventory_packaging", {
      p_item_id: row.id,
      p_base_unit: draft.baseUnit.trim(),
      p_selling_unit: draft.sellingUnit.trim(),
      p_units_per_sale: factor,
    });
    setSavingId(null);
    if (rpcError) {
      setError({ id: row.id, message: rpcError.message });
      return;
    }

    setItems((current) => current.map((item) => item.id === row.id ? {
      ...item,
      base_unit: draft.baseUnit.trim(),
      selling_unit: draft.sellingUnit.trim(),
      units_per_sale: factor,
      packaging_reviewed: true,
    } : item));
    fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
  }

  return (
    <div>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm leading-6 text-slate-600">
          Confirm how every product is stocked and sold. Example: a bag of 100 clips uses <strong>Clip</strong> as the base unit,
          <strong> Bag</strong> as the selling unit, and <strong>100</strong> base units per sale. Saving also updates historical sales
          that still have the untouched default conversion.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setFilter("unreviewed")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === "unreviewed" ? "bg-brand-navy text-white" : "border border-slate-200 text-slate-600"}`}>Needs review ({unreviewedCount})</button>
            <button type="button" onClick={() => setFilter("all")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === "all" ? "bg-brand-navy text-white" : "border border-slate-200 text-slate-600"}`}>All products ({items.length})</button>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU, or ID" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-navy sm:w-64" />
        </div>
      </section>

      {unreviewedCount === 0 && filter === "unreviewed" && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center text-sm font-semibold text-emerald-800">Every product and variant has been reviewed.</p>
      )}

      <div className="space-y-3">
        {visibleItems.map((row) => {
          const draft = drafts[row.id] ?? makeDraft(row);
          return (
            <section key={row.id} className={`rounded-2xl border p-4 ${row.packaging_reviewed ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/40"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-950">{row.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${row.packaging_reviewed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.packaging_reviewed ? "Reviewed" : "Needs review"}</span></p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{row.sku || row.id} · {row.category_name || "No category"} · Stock: {row.amount}{row.parent_id ? " · Variant" : ""}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SupplyUnitField compact label="Base stock unit" value={draft.baseUnit} onChange={(value) => updateDraft(row.id, { baseUnit: value })} />
                <SupplyUnitField compact label="Customer selling unit" value={draft.sellingUnit} onChange={(value) => updateDraft(row.id, { sellingUnit: value })} />
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{draft.baseUnit || "Units"} per {draft.sellingUnit || "sale"}</span><input type="number" min={1} step={1} value={draft.unitsPerSale} onChange={(event) => updateDraft(row.id, { unitsPerSale: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                <div className="flex items-end"><button type="button" onClick={() => save(row)} disabled={savingId === row.id} className="w-full rounded-xl bg-brand-navy px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{savingId === row.id ? "Saving..." : "Confirm packaging"}</button></div>
              </div>
              {error?.id === row.id && <p className="mt-2 text-xs font-semibold text-rose-600">{error.message}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
