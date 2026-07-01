"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui";
import type { Order, OrderStatus } from "@/types";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "ready", "completed", "cancelled", "item_unavailable"];
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending", confirmed: "Confirmed", ready: "Ready for pickup",
  completed: "Completed", cancelled: "Cancelled", item_unavailable: "Item Unavailable",
};

export default function AdminOrdersList({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders]   = useState<Order[]>(initialOrders);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter]   = useState<OrderStatus | "all">("all");
  const sb = createClient();

  useEffect(() => {
    const channel = sb
      .channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        const newOrder = payload.new as Order;
        const { data: items } = await sb.from("order_items").select("*").eq("order_id", newOrder.id);
        setOrders((prev) => prev.some((o) => o.id === newOrder.id) ? prev : [{ ...newOrder, items: items ?? [] }, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  async function setStatus(orderId: string, status: OrderStatus, attentionNote?: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, attention_note: attentionNote ?? o.attention_note } : o)));
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (attentionNote !== undefined) patch.attention_note = attentionNote;
    await sb.from("orders").update(patch).eq("id", orderId);
    fetch("/api/orders/status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    }).catch(() => {});
  }

  function saveNote(orderId: string, note: string) {
    const o = orders.find((x) => x.id === orderId);
    if (o) setStatus(orderId, o.status, note);
  }

  const visible = filter === "all" ? orders : orders.filter(o => o.status === filter);

  if (orders.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">No orders yet.</div>;
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === s ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {s === "all" ? `All (${orders.length})` : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">No orders with this status.</p>
        )}
        {visible.map((order) => {
          const isOpen = expanded === order.id;
          return (
            <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header row — always visible */}
              <div
                className="flex cursor-pointer items-center justify-between gap-3 p-4"
                onClick={() => setExpanded(isOpen ? null : order.id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{order.order_number}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="font-black text-slate-950">{formatPrice(order.total)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  {/* Items */}
                  <div className="mb-4 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-slate-900">{item.name} × {item.quantity}</span>
                        <span className="text-slate-600">{formatPrice(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <strong>Notes:</strong> {order.notes}
                    </div>
                  )}

                  {/* Status selector */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Update Status</span>
                    <select value={order.status} onChange={(e) => setStatus(order.id, e.target.value as OrderStatus)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </label>

                  {order.status === "item_unavailable" && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                      <label className="block text-xs font-bold text-amber-900 mb-1">Note to customer</label>
                      <textarea
                        defaultValue={order.attention_note}
                        onBlur={(e) => saveNote(order.id, e.target.value)}
                        rows={2}
                        placeholder="e.g. The Makita grinder is out of stock — the rest is ready."
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-amber-600">Saves on click away. Customer emailed automatically.</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
