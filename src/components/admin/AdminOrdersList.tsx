"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui";
import type { Order, OrderStatus } from "@/types";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "ready", "completed", "cancelled"];

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
        setOrders((prev) => [{ ...newOrder, items: items ?? [] }, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  async function setStatus(orderId: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    await sb.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId);
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
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
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
