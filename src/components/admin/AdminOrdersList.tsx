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
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const sb = createClient();

  // Live updates — new orders and status changes appear instantly
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
    // Auto-email the customer about the status change
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

  if (orders.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">No orders yet.</div>;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{order.order_number}</p>
              <p className="mt-1 text-sm text-slate-500">
                {new Date(order.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <OrderStatusBadge status={order.status} />
              <p className="text-xl font-black tracking-tight text-slate-950">{formatPrice(order.total)}</p>
              <select value={order.status} onChange={(e) => setStatus(order.id, e.target.value as OrderStatus)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          {order.status === "item_unavailable" && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <label className="block text-sm font-semibold text-amber-900">Note to customer (which item & why)</label>
              <p className="mb-2 text-xs text-amber-700">Shown on their orders page. They'll also see your shop phone number to call back.</p>
              <textarea
                defaultValue={order.attention_note}
                onBlur={(e) => saveNote(order.id, e.target.value)}
                rows={2}
                placeholder="e.g. The Makita grinder is out of stock — the rest of your order is ready."
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-amber-600">Saves when you click away. Customer is emailed automatically.</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-900">{item.name} × {item.quantity}</span>
                <span className="text-slate-600">{formatPrice(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>
          {order.notes && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong>Notes:</strong> {order.notes}</div>}
        </article>
      ))}
    </div>
  );
}
