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
  tax_total: number;
  tax_rate: number;
  tax_city: string;
  tax_zip: string;
  tax_exempt: boolean;
  buyer_type: "personal" | "company";
  payment_method: "cash" | "zelle" | "square" | "legacy_unknown";
  reseller_permit_status: "not_required" | "approved" | "rejected";
  status: string;
  source: string | null;
  is_test: boolean;
  sold_by_name: string;
  transaction_type: "sale" | "internal_use";
  internal_use_reason: string;
  order_items: OrderItemRow[];
}
interface InventoryRow { id: string; name: string; amount: number; }

type SaleKindFilter = "all" | "cash" | "online" | "payment_link" | "walk_in";

const SALE_KINDS: { key: SaleKindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cash", label: "Cash" },
  { key: "online", label: "Online orders" },
  { key: "payment_link", label: "Payment-link orders" },
  { key: "walk_in", label: "Walk-in orders" },
];

function matchesSaleKind(order: OrderRow, kind: SaleKindFilter) {
  if (kind === "cash") return order.payment_method === "cash";
  if (kind === "online") return order.source === "online";
  if (kind === "payment_link") return order.source === "admin_payment_link";
  if (kind === "walk_in") return order.source === "walk_in";
  return true;
}

function squareAmounts(order: OrderRow) {
  if (order.payment_method !== "square" || order.transaction_type === "internal_use") {
    return { gross: 0, fee: 0, deposit: 0 };
  }
  const grossCents = Math.max(0, Math.round(Number(order.total || 0) * 100));
  const feeCents = grossCents > 0 ? Math.round(grossCents * 0.026) + 15 : 0;
  return { gross: grossCents / 100, fee: feeCents / 100, deposit: Math.max(0, grossCents - feeCents) / 100 };
}

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
  orders: allOrders,
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
  const [expanded, setExpanded] = useState<string | null>("first");
  const [showUnsold, setShowUnsold] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [mobileTab, setMobileTab] = useState<"items" | "orders" | "staff">("items");
  const [repairingCosts, setRepairingCosts] = useState(false);
  const [costRepairMessage, setCostRepairMessage] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [saleKind, setSaleKind] = useState<SaleKindFilter>("all");
  const testFilteredOrders = useMemo(
    () => showTests ? allOrders : allOrders.filter((order) => !order.is_test),
    [allOrders, showTests],
  );
  const orders = useMemo(
    () => testFilteredOrders.filter((order) => matchesSaleKind(order, saleKind)),
    [saleKind, testFilteredOrders],
  );
  const saleKindCounts = useMemo(() => Object.fromEntries(
    SALE_KINDS.map((kind) => [kind.key, testFilteredOrders.filter((order) => matchesSaleKind(order, kind.key)).length]),
  ) as Record<SaleKindFilter, number>, [testFilteredOrders]);

  // Totals
  const stats = useMemo(() => {
    let revenue = 0, cost = 0, discounts = 0, units = 0, walkIn = 0, online = 0, internalUnits = 0, saleOrders = 0, squareGross = 0, squareFees = 0, squareDeposit = 0;
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
      const square = squareAmounts(o);
      squareGross += square.gross;
      squareFees += square.fee;
      squareDeposit += square.deposit;
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
      revenue, cost, profit, margin, discounts, units, walkIn, online, internalUnits, missingCostUnits, squareGross, squareFees, squareDeposit,
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
      ["Order", "Date", "Source", "Sold by", "Purchase for", "Payment method", "Tax city", "Tax ZIP", "Tax rate", "Tax charged", "Tax exempt", "Permit status", "Square gross", "Square fee (2.60% + $0.15)", "Final Square deposit", "Item", "SKU", "Qty", "List price", "Sold price", "Cost per base unit", "Base units per sale", "Line cost", "Discount", "Discount reason", "Line total", "Line profit"],
    ];
    for (const o of orders) {
      if (o.transaction_type === "internal_use") continue;
      const square = squareAmounts(o);
      for (const [itemIndex, it] of o.order_items.entries()) {
        const lineTotal = it.unit_price * it.quantity;
        const lineCost = costForSale(it.cost_price, it.quantity, it.base_units_per_sale);
        const costMissing = Number(it.cost_price || 0) <= 0 && it.quantity > 0;
        rows.push([
          o.order_number,
          new Date(o.created_at).toLocaleString(),
          o.source === "walk_in" ? "Walk-in" : o.source === "manual" ? "Manual" : "Online",
          o.sold_by_name || "",
          o.buyer_type === "company" ? "Company" : "Personal",
          o.payment_method === "square" ? "Square Up" : o.payment_method === "zelle" ? "Zelle" : o.payment_method === "cash" ? "Cash" : "Legacy / unknown",
          o.tax_city || "",
          o.tax_zip || "",
          (Number(o.tax_rate || 0) * 100).toFixed(2) + "%",
          Number(o.tax_total || 0).toFixed(2),
          o.tax_exempt ? "Yes" : "No",
          o.reseller_permit_status || "not_required",
          itemIndex === 0 && square.gross > 0 ? square.gross.toFixed(2) : "",
          itemIndex === 0 && square.fee > 0 ? square.fee.toFixed(2) : "",
          itemIndex === 0 && square.deposit > 0 ? square.deposit.toFixed(2) : "",
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

  const listRevenue = stats.byItem.reduce((sum, item) => sum + item.listRevenue, 0);
  const unsoldCount = stats.byItem.filter((item) => item.qty === 0).length;
  const visibleItems = showUnsold ? stats.byItem : stats.byItem.filter((item) => item.qty > 0);
  const expandedOrderId = expanded === "first" ? orders[0]?.id ?? null : expanded;
  const displayedOrders = showAllOrders ? orders : orders.slice(0, 5);

  function itemPanel(mobile = false) {
    if (mobile) {
      return (
        <div className="divide-y divide-[#e6e8ec]">
          {visibleItems.map((item) => (
            <div key={item.name} className={`grid grid-cols-[1fr_auto] gap-3 px-3 py-3 ${item.qty === 0 ? "opacity-40" : ""}`}>
              <div className="min-w-0"><p className="truncate text-xs font-bold text-[#0f172a]">{item.name}</p><p className="mt-0.5 text-[10px] text-[#5b6678]">{item.qty} sold · {item.stock} in stock</p></div>
              <div className="text-right tabular-nums"><p className="text-xs font-bold text-[#0f172a]">{item.qty ? formatPrice(item.revenue) : "—"}</p><p className={`mt-0.5 text-[10px] font-bold ${item.costMissing ? "text-[#9a4a14]" : item.profit < 0 ? "text-[#b4233a]" : "text-[#23694a]"}`}>{item.qty ? item.costMissing ? "Cost missing" : formatPrice(item.profit) : "—"}</p></div>
            </div>
          ))}
          <div className="sticky bottom-0 grid grid-cols-3 gap-2 bg-[#0f172a] px-3 py-3 text-white shadow-[0_-4px_16px_rgba(15,23,42,.12)]">
            <MiniTotal label="Units" value={String(stats.units)} /><MiniTotal label="Revenue" value={formatPrice(stats.revenue)} /><MiniTotal label="Profit" value={stats.missingCostUnits ? "Unknown" : formatPrice(stats.profit)} />
          </div>
        </div>
      );
    }
    return (
      <section className="overflow-hidden rounded-xl border border-[#e6e8ec] bg-white">
        <div className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3">
          <div><h2 className="text-sm font-bold text-[#0f172a]">Inventory and profit by item</h2><p className="text-[11px] text-[#5b6678]">Sales, cost and margin for this period</p></div>
          {unsoldCount > 0 && <button type="button" onClick={() => setShowUnsold((value) => !value)} className="min-h-9 rounded-lg border border-[#e6e8ec] px-3 text-[11px] font-bold text-[#5b6678] hover:bg-[#fbfaf8]">{showUnsold ? `Hide ${unsoldCount} unsold` : `Show ${unsoldCount} unsold`}</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-[11px] tabular-nums">
            <thead className="bg-[#fbfaf8] text-[10px] font-bold uppercase tracking-wide text-[#5b6678]"><tr><th className="w-[28%] px-3 py-2 text-left">Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Stock</th><th className="px-2 py-2 text-right max-lg:hidden">List</th><th className="px-2 py-2 text-right">Discount</th><th className="px-2 py-2 text-right">Net</th><th className="px-2 py-2 text-right">Cost</th><th className="px-2 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">Margin</th></tr></thead>
            <tbody>{visibleItems.map((item) => {
              const margin = item.revenue > 0 ? item.profit / item.revenue * 100 : 0;
              const negative = !item.costMissing && item.profit < 0;
              return <tr key={item.name} className={`h-[25px] border-t border-[#eef0f2] ${item.qty === 0 ? "text-slate-300" : "text-[#5b6678]"}`}>
                <td className="truncate px-3 font-semibold text-[#0f172a]">{negative && <span className="mr-1 text-[#9a4a14]">▲</span>}{item.name}</td><td className="px-2 text-right">{item.qty || "—"}</td><td className="px-2 text-right">{item.stock}</td><td className="px-2 text-right max-lg:hidden">{item.qty ? formatPrice(item.listRevenue) : "—"}</td><td className="px-2 text-right text-[#9a4a14]">{item.discounts ? `−${formatPrice(item.discounts)}` : "—"}</td><td className="px-2 text-right font-semibold text-[#0f172a]">{item.qty ? formatPrice(item.revenue) : "—"}</td><td className={`px-2 text-right ${item.costMissing && item.qty ? "font-bold text-[#9a4a14]" : ""}`}>{item.qty ? item.costMissing ? "Missing" : formatPrice(item.cost) : "—"}</td><td className={`px-2 text-right font-bold ${negative ? "text-[#b4233a]" : item.qty ? "text-[#23694a]" : ""}`}>{item.qty ? item.costMissing ? "—" : formatPrice(item.profit) : "—"}</td><td className={`px-3 text-right font-bold ${negative ? "text-[#b4233a]" : item.qty ? "text-[#23694a]" : ""}`}>{item.qty ? item.costMissing ? "—" : `${margin.toFixed(1)}%` : "—"}</td>
              </tr>;
            })}</tbody>
            <tfoot><tr className="h-8 border-t-2 border-[#cbd1d8] bg-[#fbfaf8] font-bold text-[#0f172a]"><td className="px-3">Totals</td><td className="px-2 text-right">{stats.units}</td><td className="px-2 text-right">{stats.byItem.reduce((sum, item) => sum + item.stock, 0)}</td><td className="px-2 text-right max-lg:hidden">{formatPrice(listRevenue)}</td><td className="px-2 text-right text-[#9a4a14]">{stats.discounts ? `−${formatPrice(stats.discounts)}` : "—"}</td><td className="px-2 text-right">{formatPrice(stats.revenue)}</td><td className="px-2 text-right">{stats.missingCostUnits ? "Incomplete" : formatPrice(stats.cost)}</td><td className="px-2 text-right text-[#23694a]">{stats.missingCostUnits ? "—" : formatPrice(stats.profit)}</td><td className="px-3 text-right text-[#23694a]">{stats.missingCostUnits ? "—" : `${stats.margin.toFixed(1)}%`}</td></tr></tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e8ec] bg-[#fbfaf8] px-4 py-2 text-[10px] text-[#5b6678]"><span>Net revenue excludes sales tax. Square deposit uses 2.60% + $0.15 per transaction.</span>{stats.missingCostUnits > 0 && <button type="button" onClick={repairHistoricalCosts} disabled={repairingCosts} className="font-bold text-[#9a4a14] disabled:opacity-50">{repairingCosts ? "Repairing…" : `Repair ${stats.missingCostUnits} missing costs`}</button>}</div>
        {costRepairMessage && <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-900">{costRepairMessage}</p>}
      </section>
    );
  }

  function staffPanel() {
    return <section className="rounded-xl border border-[#e6e8ec] bg-white p-4"><h2 className="text-sm font-bold text-[#0f172a]">By staff member</h2><div className="mt-3 space-y-3">{stats.byStaff.length === 0 ? <p className="text-xs text-[#5b6678]">No staff sales in this period.</p> : stats.byStaff.map(([name, member]) => {
      const share = stats.revenue > 0 ? member.revenue / stats.revenue * 100 : 0;
      return <div key={name}><div className="flex items-end justify-between gap-3 text-xs"><div><p className="font-bold text-[#0f172a]">{name}</p><p className="text-[10px] text-[#5b6678]">{member.count} orders{member.discounts ? ` · −${formatPrice(member.discounts)} discounts` : ""}</p></div><p className="font-bold tabular-nums text-[#0f172a]">{formatPrice(member.revenue)}</p></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eceff2]"><div className="h-full rounded-full bg-[#b4532f]" style={{ width: `${Math.max(2, share)}%` }} /></div></div>;
    })}</div></section>;
  }

  function ordersPanel(mobile = false) {
    return <section className={`overflow-hidden rounded-xl border border-[#e6e8ec] bg-white ${mobile ? "" : "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col"}`}><div className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3"><h2 className="text-sm font-bold text-[#0f172a]">Orders</h2><span className="text-[10px] font-bold uppercase tracking-wide text-[#5b6678]">Newest first</span></div><div className={`${mobile ? "" : "xl:overflow-y-auto"}`}>
      {displayedOrders.length === 0 ? <p className="px-4 py-8 text-center text-xs text-[#5b6678]">No sales in this period.</p> : displayedOrders.map((order) => {
        const isOpen = expandedOrderId === order.id;
        const square = squareAmounts(order);
        return <article key={order.id} className="border-b border-[#eef0f2] last:border-0"><button type="button" onClick={() => setExpanded(isOpen ? null : order.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[#fbfaf8]"><div className="min-w-0"><p className="truncate font-mono text-[11px] font-bold text-[#0f172a]">{order.order_number}</p><p className="mt-0.5 text-[10px] text-[#5b6678]">{new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {order.source === "admin_payment_link" ? "Payment link" : order.source === "walk_in" ? "Walk-in" : order.source === "manual" ? "Manual" : "Online"} · {order.sold_by_name || "—"}</p></div><div className="shrink-0 text-right"><p className="text-xs font-black tabular-nums text-[#0f172a]">{formatPrice(order.total)}</p><p className="text-[9px] font-bold uppercase text-[#5b6678]">{order.payment_method === "square" ? "Square" : order.payment_method || "Legacy"}</p></div></button>{isOpen && <div className="border-t border-[#eef0f2] bg-[#fbfaf8] px-3 py-3"><div className="mb-2 flex flex-wrap gap-1 text-[9px] font-bold uppercase"><span className="rounded bg-white px-2 py-1 text-[#5b6678] ring-1 ring-[#e6e8ec]">{order.buyer_type === "company" ? "Company" : "Personal"}</span><span className="rounded bg-white px-2 py-1 text-[#5b6678] ring-1 ring-[#e6e8ec]">{order.tax_city || "No city"} {order.tax_zip || ""} · {formatPrice(order.tax_total || 0)} tax</span>{order.is_test && <span className="rounded bg-violet-100 px-2 py-1 text-violet-700">Test</span>}</div><div className="space-y-1.5">{order.order_items.map((item) => <CompactOrderItem key={item.id} item={item} onSaved={() => router.refresh()} />)}</div>{square.gross > 0 && <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-900">Square: {formatPrice(square.gross)} − {formatPrice(square.fee)} = <strong>{formatPrice(square.deposit)} deposit</strong></p>}{(order.source === "walk_in" || order.source === "manual") && <div className="mt-3 flex min-h-11 flex-wrap items-center justify-end gap-3 border-t border-[#e6e8ec] pt-2">{order.transaction_type !== "internal_use" && <InternalUseButton orderId={order.id} onSaved={() => router.refresh()} />}<DeleteSaleButton orderId={order.id} orderNumber={order.order_number} onDeleted={() => router.refresh()} /></div>}</div>}</article>;
      })}
      {orders.length > 5 && <button type="button" onClick={() => setShowAllOrders((value) => !value)} className="min-h-11 w-full border-t border-[#e6e8ec] px-4 text-xs font-bold text-[#b4532f] hover:bg-[#fbfaf8]">{showAllOrders ? "Show newest 5" : `${orders.length - 5} more orders · View all`}</button>}
    </div></section>;
  }

  return (
    <div className="admin-dashboard mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#0f172a] sm:text-2xl">Sales Report <span className="font-medium text-[#5b6678]">· {from}–{to} · {stats.orders} orders</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Kind of sale" value={saleKind} onChange={(event) => { setSaleKind(event.target.value as SaleKindFilter); setExpanded("first"); }} className="h-11 rounded-lg border border-[#e6e8ec] bg-white px-3 text-xs font-bold text-[#0f172a] xl:hidden">{SALE_KINDS.map((kind) => <option key={kind.key} value={kind.key}>{kind.label} ({saleKindCounts[kind.key]})</option>)}</select>
          <div className="hidden rounded-lg border border-[#e6e8ec] bg-white p-1 xl:flex">{SALE_KINDS.map((kind) => <button key={kind.key} type="button" onClick={() => { setSaleKind(kind.key); setExpanded("first"); }} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${saleKind === kind.key ? "bg-[#b4532f] text-white" : "text-[#5b6678] hover:bg-[#fbfaf8]"}`}>{kind.label} <span className="font-medium opacity-65">{saleKindCounts[kind.key]}</span></button>)}</div>
          <button onClick={exportCsv} className="h-11 rounded-lg border border-[#e6e8ec] bg-white px-3 text-xs font-bold text-[#0f172a] hover:bg-[#fbfaf8]">CSV</button>
          <button onClick={exportQuickBooks} aria-label="Export for QuickBooks" className="h-11 rounded-lg bg-[#0f172a] px-3 text-xs font-bold text-white hover:bg-slate-800"><span className="sm:hidden">QB</span><span className="hidden sm:inline">QuickBooks</span></button>
        </div>
      </div>

      {loadError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Could not load the complete report: {loadError}</div>}
      {!loadError && orders.length === 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No sales were found from {from} through {to}. Choose Last 90 days or All time to include older sales.</div>}

      <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-[#e6e8ec] bg-white p-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => applyRange(r.key)}
            className={`hidden h-9 rounded-lg px-2.5 text-xs font-bold transition sm:block ${range === r.key ? "bg-[#0f172a] text-white" : "text-[#5b6678] hover:bg-[#fbfaf8]"}`}>
            {r.label.replace("Last ", "").replace("This ", "")}
          </button>
        ))}
        <select aria-label="Date range" value={range} onChange={(event) => applyRange(event.target.value)} className="h-11 flex-1 rounded-lg border border-[#e6e8ec] px-3 text-xs font-bold sm:hidden">{RANGES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <div className="hidden items-center gap-1 text-xs lg:flex">
          <input type="date" defaultValue={from} id="from-date" className="h-9 rounded-lg border border-[#e6e8ec] px-2" />
          <span className="text-slate-400">→</span>
          <input type="date" defaultValue={to} id="to-date" className="h-9 rounded-lg border border-[#e6e8ec] px-2" />
          <button
            onClick={() => {
              const f = (document.getElementById("from-date") as HTMLInputElement).value;
              const t = (document.getElementById("to-date") as HTMLInputElement).value;
              if (f && t) applyCustom(f, t);
            }}
            className="h-9 rounded-lg bg-[#eef0f2] px-3 font-bold text-[#0f172a] hover:bg-[#e2e6ea]">
            Apply
          </button>
        </div>
        <label className="ml-auto flex min-h-9 cursor-pointer items-center gap-2 px-2 text-xs font-bold text-[#5b6678]">
          <input type="checkbox" checked={showTests} onChange={(event) => setShowTests(event.target.checked)} />
          Include test orders
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><StatCard label="Net revenue" value={formatPrice(stats.revenue)} note={`List ${formatPrice(listRevenue)} less ${formatPrice(stats.discounts)} discounts`} accent="text-[#23694a]" /><StatCard label="Cost" value={stats.missingCostUnits ? "Incomplete" : formatPrice(stats.cost)} note={`${stats.units} units sold`} accent="text-[#0f172a]" /><StatCard label="Profit" value={stats.missingCostUnits ? "Unknown" : formatPrice(stats.profit)} note={stats.missingCostUnits ? `${stats.missingCostUnits} units need cost` : "Revenue less landed cost"} accent={stats.profit < 0 ? "text-[#b4233a]" : "text-[#23694a]"} /><StatCard label="Margin" value={stats.missingCostUnits ? "Unknown" : `${stats.margin.toFixed(1)}%`} note="Across sold inventory" accent={stats.margin < 20 ? "text-[#9a4a14]" : "text-[#23694a]"} /></div>
      <div className="mt-2 flex gap-2 overflow-x-auto rounded-xl border border-[#e6e8ec] bg-white px-3 py-2 sm:grid sm:grid-cols-8 sm:divide-x sm:divide-[#e6e8ec]"><SecondaryMetric label="Walk-in" value={formatPrice(stats.walkIn)} /><SecondaryMetric label="Online" value={formatPrice(stats.online)} /><SecondaryMetric label="Square gross" value={formatPrice(stats.squareGross)} /><SecondaryMetric label="Fees" value={`−${formatPrice(stats.squareFees)}`} caution /><SecondaryMetric label="Deposit" value={formatPrice(stats.squareDeposit)} positive /><SecondaryMetric label="Discounts" value={`−${formatPrice(stats.discounts)}`} caution /><SecondaryMetric label="Units" value={String(stats.units)} /><SecondaryMetric label="Internal" value={String(stats.internalUnits)} /></div>

      <div className="mt-3 hidden gap-4 md:grid xl:grid-cols-[minmax(0,960px)_minmax(320px,400px)]"><div>{itemPanel()}</div><aside className="grid gap-4 md:grid-cols-2 xl:flex xl:max-h-[590px] xl:flex-col xl:grid-cols-none">{staffPanel()}{ordersPanel()}</aside></div>

      <div className="mt-3 md:hidden"><div className="grid grid-cols-3 rounded-xl border border-[#e6e8ec] bg-white p-1">{(["items", "orders", "staff"] as const).map((tab) => <button key={tab} type="button" onClick={() => setMobileTab(tab)} className={`min-h-11 rounded-lg text-xs font-bold capitalize ${mobileTab === tab ? "bg-[#0f172a] text-white" : "text-[#5b6678]"}`}>{tab}</button>)}</div><div className="mt-2 overflow-hidden rounded-xl border border-[#e6e8ec] bg-white">{mobileTab === "items" && itemPanel(true)}{mobileTab === "orders" && ordersPanel(true)}{mobileTab === "staff" && <div className="border-0">{staffPanel()}</div>}</div></div>
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

function StatCard({ label, value, note, accent = "text-[#0f172a]" }: { label: string; value: string; note: string; accent?: string }) {
  return (
    <div className="min-h-[92px] rounded-xl border border-[#e6e8ec] bg-white p-3 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b6678]">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight tabular-nums sm:text-[26px] ${accent}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-[#5b6678]">{note}</p>
    </div>
  );
}

function SecondaryMetric({ label, value, positive = false, caution = false }: { label: string; value: string; positive?: boolean; caution?: boolean }) {
  return (
    <div className="min-w-[92px] px-2 sm:min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#5b6678]">{label}</p>
      <p className={`mt-0.5 text-xs font-black tabular-nums ${positive ? "text-[#23694a]" : caution ? "text-[#9a4a14]" : "text-[#0f172a]"}`}>{value}</p>
    </div>
  );
}

function MiniTotal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-0.5 text-[11px] font-black tabular-nums">{value}</p>
    </div>
  );
}

function CompactOrderItem({ item, onSaved }: { item: OrderItemRow; onSaved: () => void }) {
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2"><p className="truncate text-[11px] font-bold text-[#0f172a]">{item.name} × {item.quantity}</p><div className="mt-2 flex gap-2"><input type="number" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="h-9 w-24 rounded border border-amber-300 px-2 text-xs" autoFocus />{wouldDiscount && <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Discount reason" className="h-9 min-w-0 flex-1 rounded border border-amber-300 px-2 text-xs" />}</div>{error && <p className="mt-1 text-[10px] font-bold text-[#b4233a]">{error}</p>}<div className="mt-2 flex gap-2"><button onClick={save} disabled={saving} className="min-h-9 rounded-lg bg-[#0f172a] px-3 text-[10px] font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button><button onClick={() => { setEditing(false); setPrice(item.unit_price.toFixed(2)); setError(""); }} className="min-h-9 rounded-lg border border-[#e6e8ec] px-3 text-[10px] font-bold text-[#5b6678]">Cancel</button></div></div>
    );
  }

  const lineCost = costForSale(item.cost_price, item.quantity, item.base_units_per_sale);
  const lineProfit = item.unit_price * item.quantity - lineCost;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[10px] ring-1 ring-[#e6e8ec]"><div className="min-w-0"><p className="truncate font-semibold text-[#0f172a]">{item.name} × {item.quantity}</p><p className="text-[#5b6678]">Cost {costMissing ? "missing" : formatPrice(lineCost)} · <span className={costMissing ? "text-[#9a4a14]" : lineProfit < 0 ? "text-[#b4233a]" : "text-[#23694a]"}>Profit {costMissing ? "—" : formatPrice(lineProfit)}</span></p></div><p className="font-bold tabular-nums text-[#0f172a]">{formatPrice(item.unit_price * item.quantity)}</p><button type="button" onClick={() => setEditing(true)} className="min-h-9 px-1 font-bold text-[#b4532f]">Edit</button></div>
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
