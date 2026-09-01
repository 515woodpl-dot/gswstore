"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { costForSale } from "@/lib/packaging";

interface OrderItemRow {
  id: string;
  item_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  list_price: number | null;
  cost_price: number;
  base_units_per_sale?: number;
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
  transaction_type: "sale" | "internal_use";
  internal_use_reason: string;
  order_items: OrderItemRow[];
}
interface InventoryRow { id: string; name: string; amount: number; }

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default function SalesReport({
  orders,
  inventory,
  range,
  from,
  to,
  loadError,
}: {
  orders: OrderRow[];
  inventory: InventoryRow[];
  range: string;
  from: string;
  to: string;
  loadError?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [repairingCosts, setRepairingCosts] = useState(false);
  const [costRepairMessage, setCostRepairMessage] = useState("");

  // Totals
  const stats = useMemo(() => {
    let revenue = 0, cost = 0, discounts = 0, units = 0, walkIn = 0, online = 0, internalUnits = 0, saleOrders = 0;
    const byStaff: Record<string, { revenue: number; cost: number; discounts: number; count: number }> = {};
    let missingCostUnits = 0;
    const byItem: Record<string, { name: string; qty: number; stock: number; listRevenue: number; discounts: number; revenue: number; cost: number; profit: number; costMissing: boolean }> = {};
    for (const item of inventory) {
      byItem[item.id] = { name: item.name, qty: 0, stock: Number(item.amount) || 0, listRevenue: 0, discounts: 0, revenue: 0, cost: 0, profit: 0, costMissing: false };
    }

    for (const o of orders) {
      if (o.transaction_type === "internal_use") {
        internalUnits += o.order_items.reduce((sum, item) => sum + item.quantity, 0);
        continue;
      }
      saleOrders += 1;
      const orderMerchandiseRevenue = o.order_items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
      const orderDiscount = o.order_items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
      revenue += orderMerchandiseRevenue;
      discounts += orderDiscount;
      for (const it of o.order_items) {
        units += it.quantity;
        const itemCost = costForSale(it.cost_price, it.quantity, it.base_units_per_sale);
        const itemRev = Number(it.unit_price) * it.quantity;
        const itemListRevenue = Number(it.list_price ?? it.unit_price) * it.quantity;
        const itemDiscount = Number(it.discount_amount || 0);
        cost += itemCost;

        const key = it.item_id || `sold-${it.id}`;
        if (!byItem[key]) byItem[key] = { name: it.name, qty: 0, stock: 0, listRevenue: 0, discounts: 0, revenue: 0, cost: 0, profit: 0, costMissing: false };
        byItem[key].qty += it.quantity;
        byItem[key].listRevenue += itemListRevenue;
        byItem[key].discounts += itemDiscount;
        byItem[key].revenue += itemRev;
        byItem[key].cost += itemCost;
        byItem[key].profit += itemRev - itemCost;
        if (Number(it.cost_price || 0) <= 0 && it.quantity > 0) {
          byItem[key].costMissing = true;
          missingCostUnits += it.quantity;
        }
      }
      if (o.source === "walk_in") walkIn += orderMerchandiseRevenue; else online += orderMerchandiseRevenue;

      const staff = o.sold_by_name || (o.source === "walk_in" ? "Unknown staff" : "Online");
      if (!byStaff[staff]) byStaff[staff] = { revenue: 0, cost: 0, discounts: 0, count: 0 };
      byStaff[staff].revenue += orderMerchandiseRevenue;
      byStaff[staff].discounts += orderDiscount;
      byStaff[staff].count += 1;
      for (const it of o.order_items) byStaff[staff].cost += costForSale(it.cost_price, it.quantity, it.base_units_per_sale);
    }
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      revenue, cost, profit, margin, discounts, units, walkIn, online, internalUnits, missingCostUnits,
      orders: saleOrders,
      byStaff: Object.entries(byStaff).sort((a, b) => b[1].revenue - a[1].revenue),
      byItem: Object.values(byItem).sort((a, b) => b.revenue - a.revenue),
    };
  }, [inventory, orders]);

  function applyRange(key: string) {
    router.push(`/admin/sales?range=${key}`);
  }
  function applyCustom(f: string, t: string) {
    router.push(`/admin/sales?from=${f}&to=${t}`);
  }

  async function repairHistoricalCosts() {
    const confirmed = window.confirm(
      "Historical costs were not saved when these sales were created. This will use each product's CURRENT average landed cost as an estimate. It will not replace costs already captured. Continue?",
    );
    if (!confirmed) return;

    setRepairingCosts(true);
    setCostRepairMessage("");
    try {
      const response = await fetch("/api/admin/backfill-sale-costs", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setCostRepairMessage(result.error || "Could not repair historical costs.");
        return;
      }
      const updated = Number(result.updated) || 0;
      setCostRepairMessage(
        updated > 0
          ? `${updated} historical sale line${updated === 1 ? "" : "s"} repaired using current landed costs.`
          : "No lines were repaired. Add an Average Landed Cost to the affected products in Inventory first.",
      );
      router.refresh();
    } catch {
      setCostRepairMessage("Could not repair historical costs.");
    } finally {
      setRepairingCosts(false);
    }
  }

  function exportCsv() {
    const rows: string[][] = [
      ["Order", "Date", "Source", "Sold by", "Item", "SKU", "Qty", "List price", "Sold price", "Cost per base unit", "Base units per sale", "Line cost", "Discount", "Discount reason", "Line total", "Line profit"],
    ];
    for (const o of orders) {
      if (o.transaction_type === "internal_use") continue;
      for (const it of o.order_items) {
        const lineTotal = it.unit_price * it.quantity;
        const lineCost = costForSale(it.cost_price, it.quantity, it.base_units_per_sale);
        const costMissing = Number(it.cost_price || 0) <= 0 && it.quantity > 0;
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
          costMissing ? "" : Number(it.cost_price).toFixed(2),
          String(it.base_units_per_sale || 1),
          costMissing ? "" : lineCost.toFixed(2),
          Number(it.discount_amount).toFixed(2),
          it.discount_reason ?? "",
          lineTotal.toFixed(2),
          costMissing ? "" : (lineTotal - lineCost).toFixed(2),
        ]);
      }
    }
    downloadCsv(rows, `sps-sales-${from}-to-${to}.csv`);
  }

  // QuickBooks Online — Sales Receipt import format.
  // One row per line item; rows sharing a Sales Receipt No. group into one receipt.
  function exportQuickBooks() {
    const rows: string[][] = [
      ["SalesReceiptNo", "Customer", "SalesReceiptDate", "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount"],
    ];
    for (const o of orders) {
      if (o.transaction_type === "internal_use") continue;
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

      {loadError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Could not load the complete report: {loadError}</div>}
      {!loadError && orders.length === 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No sales were found from {from} through {to}. Choose Last 90 days or All time to include older sales.</div>}

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
        <StatCard label="Net product revenue" value={formatPrice(stats.revenue)} accent="text-emerald-700" />
        <StatCard label={stats.missingCostUnits > 0 ? "Cost (incomplete)" : "Cost"} value={formatPrice(stats.cost)} accent="text-slate-700" />
        <StatCard label={stats.missingCostUnits > 0 ? "Profit (incomplete)" : "Profit"} value={stats.missingCostUnits > 0 ? "Unknown" : formatPrice(stats.profit)} accent={stats.missingCostUnits > 0 ? "text-amber-700" : stats.profit >= 0 ? "text-emerald-700" : "text-rose-700"} />
        <StatCard label={stats.missingCostUnits > 0 ? "Margin (incomplete)" : "Margin"} value={stats.missingCostUnits > 0 ? "Unknown" : `${stats.margin.toFixed(1)}%`} accent={stats.missingCostUnits > 0 ? "text-amber-700" : stats.margin >= 20 ? "text-emerald-700" : "text-amber-700"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Discounts given" value={formatPrice(stats.discounts)} accent="text-amber-700" />
        <StatCard label="Units sold" value={String(stats.units)} />
        <StatCard label="Walk-in revenue" value={formatPrice(stats.walkIn)} />
        <StatCard label="Online revenue" value={formatPrice(stats.online)} />
        {stats.internalUnits > 0 && <StatCard label="Internal-use units" value={String(stats.internalUnits)} accent="text-slate-700" />}
      </div>
      <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        Net product revenue is the item amount actually collected after discounts, excluding sales tax. Cost is captured from inventory when the item is sold, so later receiving-cost changes do not alter past profit.
      </p>
      {stats.missingCostUnits > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">
          <p>Cost is missing for {stats.missingCostUnits} sold unit{stats.missingCostUnits === 1 ? "" : "s"}. Profit and margin stay hidden so the report never treats unknown cost as $0.</p>
          <p className="mt-1 text-xs text-amber-800">If these products now have an Average Landed Cost in Inventory, you can use that current cost as the best available historical estimate.</p>
          <button
            type="button"
            onClick={repairHistoricalCosts}
            disabled={repairingCosts}
            className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-950 disabled:cursor-wait disabled:opacity-60"
          >
            {repairingCosts ? "Repairing costs..." : "Backfill from current inventory costs"}
          </button>
          {costRepairMessage && <p className="mt-2 text-xs font-semibold">{costRepairMessage}</p>}
        </div>
      )}

      {/* Item profit breakdown button */}
      <div className="mt-4 flex justify-end">
        <button onClick={() => setShowItems(!showItems)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          {showItems ? "Hide item breakdown" : "📦 View profit by item"}
        </button>
      </div>

      {/* Per-item profit breakdown */}
      {showItems && stats.byItem.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-950">Inventory and profit by item</h2>
          <p className="mt-1 text-xs text-slate-400">All inventory products are shown. List sales less discounts equals net revenue. Cost = what you paid × qty sold.</p>

          {/* Mobile: the nine-column table becomes one readable card per item. */}
          <div className="mt-4 space-y-3 lg:hidden">
            {stats.byItem.map((item) => {
              const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
              return (
                <article key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-sm font-bold leading-5 text-slate-900">{item.name}</h3>
                    <div className="shrink-0 text-right text-[11px] font-semibold text-slate-500">
                      <p>{item.qty} sold</p>
                      <p>{item.stock} in stock</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-3">
                    <MobileMetric label="List sales" value={formatPrice(item.listRevenue)} />
                    <MobileMetric label="Discounts" value={item.discounts > 0 ? `-${formatPrice(item.discounts)}` : "-"} valueClass="text-amber-700" />
                    <MobileMetric label="Net revenue" value={formatPrice(item.revenue)} strong />
                    <MobileMetric label="Cost" value={item.costMissing ? "Missing" : formatPrice(item.cost)} valueClass={item.costMissing ? "text-amber-700" : "text-slate-700"} />
                  </dl>
                  <div className="mt-3 flex items-end justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Profit</p>
                      <p className={`mt-0.5 text-lg font-black ${item.costMissing ? "text-amber-700" : item.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.costMissing ? "Unknown" : formatPrice(item.profit)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Margin</p>
                      <p className={`mt-0.5 text-sm font-black ${item.costMissing ? "text-amber-700" : margin >= 20 ? "text-emerald-700" : margin >= 0 ? "text-amber-600" : "text-rose-700"}`}>
                        {item.costMissing ? "Unknown" : `${margin.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}

            <section className="rounded-2xl bg-brand-navy p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Report totals</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MobileTotal label="Units sold" value={String(stats.units)} />
                <MobileTotal label="In stock" value={String(stats.byItem.reduce((sum, item) => sum + item.stock, 0))} />
                <MobileTotal label="List sales" value={formatPrice(stats.byItem.reduce((sum, item) => sum + item.listRevenue, 0))} />
                <MobileTotal label="Discounts" value={stats.discounts > 0 ? `-${formatPrice(stats.discounts)}` : "-"} />
                <MobileTotal label="Net revenue" value={formatPrice(stats.revenue)} />
                <MobileTotal label="Cost" value={stats.missingCostUnits > 0 ? "Incomplete" : formatPrice(stats.cost)} />
                <MobileTotal label="Profit" value={stats.missingCostUnits > 0 ? "Unknown" : formatPrice(stats.profit)} />
                <MobileTotal label="Margin" value={stats.missingCostUnits > 0 ? "Unknown" : `${stats.margin.toFixed(1)}%`} />
              </div>
            </section>
          </div>

          {/* Desktop: retain the dense comparison table where it has room. */}
          <div className="mt-3 hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-400">
                  <th className="pb-2 text-left font-semibold">Item</th>
                  <th className="pb-2 text-right font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">In stock</th>
                  <th className="pb-2 text-right font-semibold">List sales</th>
                  <th className="pb-2 text-right font-semibold">Discounts</th>
                  <th className="pb-2 text-right font-semibold">Net revenue</th>
                  <th className="pb-2 text-right font-semibold">Cost</th>
                  <th className="pb-2 text-right font-semibold">Profit</th>
                  <th className="pb-2 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {stats.byItem.map((item) => {
                  const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
                  return (
                    <tr key={item.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2 text-right text-slate-600">{item.qty}</td>
                      <td className="py-2 text-right text-slate-600">{item.stock}</td>
                      <td className="py-2 text-right text-slate-600">{formatPrice(item.listRevenue)}</td>
                      <td className="py-2 text-right text-amber-700">{item.discounts > 0 ? `−${formatPrice(item.discounts)}` : "—"}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">{formatPrice(item.revenue)}</td>
                      <td className={`py-2 text-right ${item.costMissing ? "font-semibold text-amber-700" : "text-slate-500"}`}>{item.costMissing ? "Missing" : formatPrice(item.cost)}</td>
                      <td className={`py-2 text-right font-bold ${item.costMissing ? "text-amber-700" : item.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.costMissing ? "—" : formatPrice(item.profit)}
                      </td>
                      <td className={`py-2 text-right text-xs font-semibold ${item.costMissing ? "text-amber-700" : margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-rose-600"}`}>
                        {item.costMissing ? "—" : `${margin.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="pt-2 font-bold text-slate-950">Totals</td>
                  <td className="pt-2 text-right font-semibold">{stats.units}</td>
                  <td className="pt-2 text-right font-semibold">{stats.byItem.reduce((sum, item) => sum + item.stock, 0)}</td>
                  <td className="pt-2 text-right font-semibold">{formatPrice(stats.byItem.reduce((sum, item) => sum + item.listRevenue, 0))}</td>
                  <td className="pt-2 text-right font-semibold text-amber-700">{stats.discounts > 0 ? `−${formatPrice(stats.discounts)}` : "—"}</td>
                  <td className="pt-2 text-right font-bold text-slate-900">{formatPrice(stats.revenue)}</td>
                  <td className={`pt-2 text-right font-semibold ${stats.missingCostUnits > 0 ? "text-amber-700" : "text-slate-500"}`}>{stats.missingCostUnits > 0 ? "Incomplete" : formatPrice(stats.cost)}</td>
                  <td className={`pt-2 text-right font-black ${stats.missingCostUnits > 0 ? "text-amber-700" : stats.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {stats.missingCostUnits > 0 ? "—" : formatPrice(stats.profit)}
                  </td>
                  <td className={`pt-2 text-right text-xs font-bold ${stats.missingCostUnits > 0 ? "text-amber-700" : stats.margin >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                    {stats.missingCostUnits > 0 ? "—" : `${stats.margin.toFixed(1)}%`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
        {orders.map((o) => {
          const orderDiscount = o.order_items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
          return <div key={o.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div>
                <span className="font-mono text-sm font-bold text-slate-900">{o.order_number}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${o.transaction_type === "internal_use" ? "bg-slate-200 text-slate-700" : o.source === "walk_in" ? "bg-sky-100 text-sky-800" : o.source === "manual" ? "bg-orange-100 text-orange-800" : "bg-violet-100 text-violet-800"}`}>
                  {o.transaction_type === "internal_use" ? "Internal use" : o.source === "walk_in" ? "Walk-in" : o.source === "manual" ? "Manual" : "Online"}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(o.created_at).toLocaleString()} · {o.sold_by_name || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-900">{formatPrice(o.total)}</p>
                {orderDiscount > 0 && <p className="text-xs font-semibold text-amber-700">−{formatPrice(orderDiscount)}</p>}
              </div>
            </button>
            {expanded === o.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                {o.transaction_type === "internal_use" && <p className="mb-3 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Excluded from sales, discounts, profit, and margin. {o.internal_use_reason && `Reason: ${o.internal_use_reason}`}</p>}
                <table className="w-full text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="text-left font-semibold">Item</th>
                      <th className="text-right font-semibold">Qty</th>
                      <th className="text-right font-semibold">List</th>
                      <th className="text-right font-semibold">Sold</th>
                      <th className="text-right font-semibold">Discount</th>
                      <th className="text-right font-semibold">Cost</th>
                      <th className="text-right font-semibold">Profit</th>
                      <th className="text-right font-semibold">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.order_items.map((it) => (
                      <EditableItemRow key={it.id} item={it} onSaved={() => router.refresh()} />
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-right text-xs text-slate-400">Editing a price updates the order total, profit, and exports.</p>
                {(o.source === "walk_in" || o.source === "manual") && (
                  <div className="mt-3 border-t border-slate-200 pt-3 text-right">
                    {o.transaction_type !== "internal_use" && <InternalUseButton orderId={o.id} onSaved={() => router.refresh()} />}
                    <DeleteSaleButton orderId={o.id} orderNumber={o.order_number} onDeleted={() => router.refresh()} />
                  </div>
                )}
              </div>
            )}
          </div>;
        })}
      </div>
    </div>
  );
}

function InternalUseButton({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
  async function markInternal() {
    const reason = window.prompt("Reason for internal use or donation:");
    if (reason === null) return;
    const response = await fetch("/api/admin/internal-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, reason }) });
    if (!response.ok) alert((await response.json()).error || "Could not classify this order."); else onSaved();
  }
  return <button onClick={markInternal} className="mr-4 text-xs font-semibold text-slate-700 hover:text-slate-950">Mark internal use</button>;
}

function StatCard({ label, value, accent = "text-slate-950" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function MobileMetric({ label, value, valueClass = "text-slate-700", strong = false }: { label: string; value: string; valueClass?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm ${strong ? "font-black" : "font-semibold"} ${valueClass}`}>{value}</dd>
    </div>
  );
}

function MobileTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-0.5 break-words text-sm font-black text-white">{value}</p>
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
  const costMissing = Number(item.cost_price || 0) <= 0 && item.quantity > 0;

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
        <td className="py-2 text-right" colSpan={4}>
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
      <td className={`py-1.5 text-right ${costMissing ? "font-semibold text-amber-700" : "text-slate-500"}`}>{costMissing ? "Missing" : formatPrice(costForSale(item.cost_price, item.quantity, item.base_units_per_sale))}</td>
      <td className={`py-1.5 text-right font-semibold ${costMissing ? "text-amber-700" : item.unit_price * item.quantity - costForSale(item.cost_price, item.quantity, item.base_units_per_sale) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
        {costMissing ? "—" : formatPrice(item.unit_price * item.quantity - costForSale(item.cost_price, item.quantity, item.base_units_per_sale))}
      </td>
      <td className="py-1.5 text-right">
        <button onClick={() => setEditing(true)} className="font-semibold text-brand-navy hover:underline">Edit</button>
      </td>
    </tr>
  );
}

function DeleteSaleButton({ orderId, orderNumber, onDeleted }: { orderId: string; orderNumber: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-sale", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Could not delete the sale.");
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch {
      alert("Could not delete the sale.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-rose-600 hover:text-rose-800">
        🗑 Remove this sale
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-rose-700">Delete {orderNumber}? Inventory will be restored.</span>
      <button onClick={handleDelete} disabled={deleting}
        className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
        {deleting ? "Deleting…" : "Yes, delete"}
      </button>
      <button onClick={() => setConfirming(false)}
        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
        Cancel
      </button>
    </div>
  );
}
