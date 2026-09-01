"use client";

import { useState } from "react";

type Code = { id: string; name: string; code: string; percent_off: number; active: boolean };

export default function DiscountCodesManager({ initialCodes, setupError }: { initialCodes: Code[]; setupError?: string }) {
  const [codes, setCodes] = useState(initialCodes);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState(10);
  const [error, setError] = useState(setupError || "");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function add() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, percentOff: percent }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not create the discount code.");
        return;
      }
      setCodes((items) => [result.code as Code, ...items]);
      setName("");
      setCode("");
    } catch {
      setError("Could not create the discount code. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Code) {
    setError("");
    setUpdatingId(item.id);
    try {
      const response = await fetch("/api/admin/discount-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.active }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not update the discount code.");
        return;
      }
      setCodes((items) => items.map((codeItem) => codeItem.id === item.id ? result.code as Code : codeItem));
    } catch {
      setError("Could not update the discount code. Check your connection and try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-black text-slate-950">Online Discount Codes</h1>
      <p className="mt-2 text-sm text-slate-500">One active code appears in the store banner and applies at checkout.</p>

      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign name" className="rounded-xl border border-slate-300 p-2" />
        <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="WELCOME" className="rounded-xl border border-slate-300 p-2 font-mono" />
        <input value={percent} onChange={(event) => setPercent(Number(event.target.value))} type="number" min="1" max="100" aria-label="Discount percent" className="rounded-xl border border-slate-300 p-2" />
        <button type="button" onClick={add} disabled={saving} className="rounded-xl bg-brand-navy px-4 py-2 font-bold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
          {saving ? "Creating..." : "Create code"}
        </button>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 sm:col-span-4">{error}</p>}
      </div>

      <div className="mt-5 space-y-2">
        {codes.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No discount codes yet.</p>}
        {codes.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-sm text-slate-700"><b className="text-slate-950">{item.name}</b><span className="ml-3 font-mono font-bold">{item.code}</span> <span className="text-slate-400">-</span> {item.percent_off}%</span>
            <button type="button" onClick={() => toggle(item)} disabled={updatingId === item.id} className={`rounded-lg border px-3 py-1 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${item.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
              {updatingId === item.id ? "Saving..." : item.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
