import type { StockStatus, OrderStatus } from "@/types";

export function StockBadge({ status }: { status: StockStatus }) {
  const meta = {
    in_stock: { label: "In Stock", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    low_stock: { label: "Low Stock", cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" },
    out_of_stock: { label: "Out of Stock", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
  }[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = {
    pending:   { label: "Pending",           cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" },
    confirmed: { label: "Confirmed",         cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
    ready:     { label: "Ready for Pickup",  cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    completed: { label: "Completed",         cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" },
    cancelled: { label: "Cancelled",         cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
    item_unavailable: { label: "Item Unavailable", cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-300" },
  }[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
}

export function QuantitySelector({
  value, onChange, max = 99,
}: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" aria-label="Decrease">−</button>
      <div className="min-w-12 border-x border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-900">{value}</div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" aria-label="Increase">+</button>
    </div>
  );
}
