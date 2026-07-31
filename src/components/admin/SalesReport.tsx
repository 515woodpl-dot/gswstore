"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";

interface OrderItemRow {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  list_price: number | null;
  discount_amount: number;
  discount_reason: string;
}
interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  discount_total: number;
  status: string;
  source: string | null;
  sold_by_name: string;
  order_items: OrderItemRow[];
}

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

export default function SalesReport({
  orders,
  range,
  from,
  to,
}: {
  orders: OrderRow[];
  range: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Totals
  const stats = useMemo(() => {
    let revenue = 0, discounts = 0, units = 0, walkIn = 0, online = 0;
    const byStaff: Record<string, { revenue: number; discounts: number; count: number }> = {};

    for (const o of orders) {
      revenue += Number(o.total);
      discounts += Number(o.discount_total);
      for (const it of o.order_items) units += it.quantity;
      if (o.source === "walk_in") walkIn += Number(o.total); else online += Number(o.total);

      const staff = o.sold_by_name || (o.source === "walk_in" ? "Unknown staff" : "Online");
      if (!byStaff[staff]) byStaff[staff] = { revenue: 0, discounts: 0, count: 0 };
      byStaff[staff].revenue += Number(o.total);
      byStaff[staff].discounts += Number(o.discount_total);
      byStaff[staff].count += 1;
    }
    return {
      revenue, discounts, units, walkIn, online,
      orders: orders.length,
      byStaff: Object.entries(byStaff).sort((a, b) => b[1].revenue - a[1].revenue),
    };
  }, [orders]);

  function applyRange(key: string) {
    router.push(`/admin/sales?range=${key}`);
  }
  function applyCustom(f: string, t: string) {
    router.push(`/admin/sales?from=${f}&to=${t}`);
  }

  function exportCsv() {
    const rows: string[][] = [
      ["Order", "Date", "Source", "Sold by", "Item", "SKU", "Qty", "List price", "Sold price", "Discount", "Discount reason", "Line total"],
    ];
    for (const o of orders) {
      for (const it of o.order_items) {
        rows.push([
          o.order_number,
          new Date(o.created_at).toLocaleString(),
          o.source === "walk_in" ? "Walk-in" : o.source === "manual" ? "Manual" : "Online",
          o.sold_by_name || "",
          it.name,
          it.sku ?? "",
          String(it.quantity),
          it.list_price != null ? it.list_price.toFixed(2) : "",
          it.unit_price.toFixed(2),
          Number(it.discount_amount).toFixed(2),
          it.discount_reason ?? "",
          (it.unit_price * it.quantity).toFixed(2),
        ]);
      }
    }
    downloadCsv(rows, `gsw-sales-${from}-to-${to}.csv`);
  }

  // QuickBooks Online — Sales Receipt import format.
  // One row per line item; rows sharing a Sales Receipt No. group into one receipt.
  function exportQuickBooks() {
    const rows: string[][] = [
      ["SalesReceiptNo", "Customer", "SalesReceiptDate", "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount"],
    ];
    for (const o of orders) {
      const date = new Date(o.created_at);
      const qbDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      const customer =
        o.source === "walk_in" ? "Walk-in Customer"
        : o.source === "manual" ? "Walk-in Customer"
        : "Online Customer";
      for (const it of o.order_items) {
        rows.push([
          o.order_number,
          customer,
          qbDate,
          it.name,
          it.discount_reason ? `${it.name} (${it.discount_reason})` : it.name,
          String(it.quantity),
          it.unit_price.toFixed(2),
          (it.unit_price * it.quantity).toFixed(2),
        ]);
      }
    }
    downloadCsv(rows, `gsw-quickbooks-${from}-to-${to}.csv`);
  }

  function downloadCsv(rows: string[][], filename: string) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Sales Report</h1>
          <p className="mt-1 text-sm text-slate-500">{from} → {to} · {stats.orders} orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            ⬇ CSV
          </button>
          <button onClick={exportQuickBooks} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            ⬇ QuickBooks
          </button>
        </div>
      </div>

      {/* Range filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => applyRange(r.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${range === r.key ? "bg-brand-navy text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {r.label}
          </button>
        ))}
        <div className="ml-2 flex items-center gap-1 text-sm">
          <input type="date" defaultValue={from} id="from-date" className="rounded-lg border border-slate-200 px-2 py-1" />
          <span className="text-slate-400">→</span>
          <input type="date" defaultValue={to} id="to-date" className="rounded-lg border border-slate-200 px-2 py-1" />
          <button
            onClick={() => {
              const f = (document.getElementById("from-date") as HTMLInputElement).value;
              const t = (document.getElementById("to-date") as HTMLInputElement).value;
              if (f && t) applyCustom(f, t);
            }}
            className="rounded-lg bg-slate-100 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-200">
            Apply
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue" value={formatPrice(stats.revenue)} accent="text-emerald-700" />
        <StatCard label="Discounts given" value={formatPrice(stats.discounts)} accent="text-amber-700" />
        <StatCard label="Units sold" value={String(stats.units)} />
        <StatCard label="Orders" value={String(stats.orders)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label="Walk-in revenue" value={formatPrice(stats.walkIn)} />
        <StatCard label="Online revenue" value={formatPrice(stats.online)} />
      </div>

      {/* By staff */}
      {stats.byStaff.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-950">By staff member</h2>
          <div className="mt-3 space-y-2">
            {stats.byStaff.map(([name, s]) => (
              <div key={name} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0">
                <span className="font-semibold text-slate-800">{name}</span>
                <span className="flex gap-4 text-slate-600">
                  <span>{s.count} orders</span>
                  <span className="font-bold text-slate-900">{formatPrice(s.revenue)}</span>
                  {s.discounts > 0 && <span className="text-amber-700">−{formatPrice(s.discounts)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order list */}
      <h2 className="mt-8 text-base font-bold text-slate-950">Orders</h2>
      <div className="mt-3 space-y-2">
        {orders.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
            No sales in this period.
          </p>
        )}
        {orders.map((o) => (
          <div key={o.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div>
                <span className="font-mono text-sm font-bold text-slate-900">{o.order_number}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${o.source === "walk_in" ? "bg-sky-100 text-sky-800" : o.source === "manual" ? "bg-orange-100 text-orange-800" : "bg-violet-100 text-violet-800"}`}>
                  {o.source === "walk_in" ? "Walk-in" : o.source === "manual" ? "Manual" : "Online"}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(o.created_at).toLocaleString()} · {o.sold_by_name || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-900">{formatPrice(o.total)}</p>
                {o.discount_total > 0 && <p className="text-xs font-semibold text-amber-700">−{formatPrice(o.discount_total)}</p>}
              </div>
            </button>
            {expanded === o.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                <table className="w-full text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="text-left font-semibold">Item</th>
                      <th className="text-right font-semibold">Qty</th>
                      <th className="text-right font-semibold">List</th>
                      <th className="text-right font-semibold">Sold</th>
                      <th className="text-right font-semibold">Discount</th>
                      <th className="text-right font-semibold">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.order_items.map((it) => (
                      <EditableItemRow key={it.id} item={it} onSaved={() => router.refresh()} />
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-right text-xs text-slate-400">Editing a price updates the order total and the exports.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "text-slate-950" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function EditableItemRow({ item, onSaved }: { item: OrderItemRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(item.unit_price.toFixed(2));
  const [reason, setReason] = useState(item.discount_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const list = item.list_price ?? item.unit_price;
  const newPrice = Number(price);
  const wouldDiscount = list - newPrice > 0;

  async function save() {
    setError("");
    if (isNaN(newPrice) || newPrice < 0) { setError("Invalid price"); return; }
    if (wouldDiscount && !reason.trim()) { setError("Reason required for a discount"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/edit-sale-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, newUnitPrice: newPrice, discountReason: reason }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed"); setSaving(false); return; }
      setEditing(false);
      onSaved(); // refresh the report so totals + exports reflect the change
    } catch {
      setError("Failed to save");
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-amber-50/40">
        <td className="py-2 text-slate-800" colSpan={2}>
          <span className="font-semibold">{item.name}</span>
          <span className="ml-2 text-slate-400">× {item.quantity}</span>
        </td>
        <td className="py-2 text-right text-slate-500">{item.list_price != null ? formatPrice(item.list_price) : "—"}</td>
        <td className="py-2 text-right">
          <span className="text-slate-400">$</span>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
            className="ml-1 w-20 rounded border border-slate-300 px-2 py-1 text-right text-xs" autoFocus />
        </td>
        <td className="py-2 text-right" colSpan={2}>
          <div className="flex flex-col items-end gap-1">
            {wouldDiscount && (
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Discount reason"
                className="w-full max-w-[180px] rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs" />
            )}
            {error && <span className="text-rose-600">{error}</span>}
            <div className="flex gap-1">
              <button onClick={save} disabled={saving} className="rounded bg-brand-navy px-2 py-1 text-xs font-bold text-white disabled:opacity-50">
                {saving ? "…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setPrice(item.unit_price.toFixed(2)); setError(""); }} className="rounded border border-slate-200 px-2 py-1 text-xs">
                Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 text-slate-800">
        {item.name}
        {item.discount_reason && <span className="ml-1 text-amber-700">({item.discount_reason})</span>}
      </td>
      <td className="py-1.5 text-right">{item.quantity}</td>
      <td className="py-1.5 text-right text-slate-500">{item.list_price != null ? formatPrice(item.list_price) : "—"}</td>
      <td className="py-1.5 text-right font-semibold">{formatPrice(item.unit_price)}</td>
      <td className="py-1.5 text-right text-amber-700">{Number(item.discount_amount) > 0 ? `−${formatPrice(item.discount_amount)}` : "—"}</td>
      <td className="py-1.5 text-right">
        <button onClick={() => setEditing(true)} className="font-semibold text-brand-navy hover:underline">Edit</button>
      </td>
    </tr>
  );
}
