"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, orderStatusLabel, orderStatusColor } from "@/lib/utils";
import BrandLogo from "@/components/BrandLogo";
import type { Order, OrderItem, OrderStatus } from "@/types";

const STATUS_ACTIONS: { status: OrderStatus; label: string; color: string; hoverColor: string }[] = [
  { status: "confirmed",        label: "Confirm",          color: "bg-brand-navy text-white",           hoverColor: "hover:bg-[#2d4a5a]" },
  { status: "ready",            label: "Ready for Pickup", color: "bg-emerald-600 text-white",          hoverColor: "hover:bg-emerald-700" },
  { status: "item_unavailable", label: "Item Unavailable", color: "bg-brand-gold text-white",           hoverColor: "hover:bg-amber-500" },
  { status: "completed",        label: "Completed",        color: "bg-slate-500 text-white",            hoverColor: "hover:bg-slate-600" },
  { status: "cancelled",        label: "Cancel Order",     color: "bg-brand-primary text-white",        hoverColor: "hover:bg-red-700" },
];

export default function AlertsScreen({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders]       = useState<Order[]>(initialOrders);
  const [active, setActive]       = useState<Order | null>(null);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn]     = useState(true);
  const [clock, setClock]         = useState("");
  const [filter, setFilter]       = useState<"active" | "all">("active");
  const [updating, setUpdating]   = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [editQty, setEditQty]     = useState<Record<string, number>>({});
  const soundRef     = useRef(true);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = createClient();

  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Update order status + notify customer
  const updateStatus = useCallback(async (order: Order, newStatus: OrderStatus) => {
    setUpdating(order.id + newStatus);
    try {
      const { error } = await sb.from("orders").update({ status: newStatus }).eq("id", order.id);
      if (error) throw error;
      const updated = { ...order, status: newStatus };
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      setActive(prev => prev?.id === order.id ? updated : prev);
      const res = await fetch("/api/orders/status-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      showToast(res.ok ? `"${orderStatusLabel(newStatus)}" — customer notified` : `Status updated but email failed`, res.ok);
    } catch { showToast("Failed to update status", false); }
    setUpdating(null);
  }, [sb]);

  // Update item quantity
  const updateQty = useCallback(async (order: Order, item: OrderItem, newQty: number) => {
    if (newQty < 1) return;
    setUpdating("qty" + item.id);
    try {
      const { error } = await sb.from("order_items").update({ quantity: newQty }).eq("id", item.id);
      if (error) throw error;
      // Recalculate total
      const newItems = order.items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i);
      const newTotal = newItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      await sb.from("orders").update({ total: newTotal }).eq("id", order.id);
      const updated = { ...order, items: newItems, total: newTotal };
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      setActive(prev => prev?.id === order.id ? updated : prev);
      setEditQty(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      showToast("Quantity updated");
    } catch { showToast("Failed to update quantity", false); }
    setUpdating(null);
  }, [sb]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-US", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  // Chime
  const playChime = useCallback(() => {
    if (!soundRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [[880, 0], [1100, 0.15], [880, 0.3], [1320, 0.45]].forEach(([freq, t]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + t); osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.25);
      });
    } catch { /* ignore */ }
  }, []);

  const showAlert = useCallback((order: Order) => {
    setActive(order);
    playChime();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setActive(null), 30000);
  }, [playChime]);

  // Realtime
  useEffect(() => {
    const channel = sb
      .channel("alerts-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        const o = payload.new as Order;
        const { data: items } = await sb.from("order_items").select("*").eq("order_id", o.id);
        const full = { ...o, items: items ?? [] };
        setOrders((prev) => prev.some((p) => p.id === full.id) ? prev : [full, ...prev].slice(0, 50));
        showAlert(full);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const u = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === u.id ? { ...o, ...u } : o)));
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { sb.removeChannel(channel); };
  }, [sb, showAlert]);

  // Poll every 20s
  useEffect(() => {
    const poll = setInterval(async () => {
      const { data } = await sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(50);
      if (!data) return;
      setOrders((prev) => {
        const known = new Set(prev.map((o) => o.id));
        const fetched: Order[] = data.map((o) => ({ ...o, items: o.order_items }));
        const missed = fetched.filter((o) => !known.has(o.id));
        if (missed.length === 0) {
          return prev.map((p) => { const fresh = fetched.find((f) => f.id === p.id); return fresh ? { ...p, status: fresh.status } : p; });
        }
        showAlert(missed[0]);
        return [...missed, ...prev].slice(0, 50);
      });
    }, 20000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const activeStatuses: OrderStatus[] = ["pending", "confirmed", "ready"];
  const visibleOrders = filter === "active"
    ? orders.filter(o => activeStatuses.includes(o.status as OrderStatus))
    : orders;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(239,81,35,0.08),_transparent_30%),linear-gradient(180deg,_#fffdfb_0%,_#f6fbfc_52%,_#ffffff_100%)] text-slate-700">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl transition ${toast.ok ? "bg-brand-navy" : "bg-brand-primary"}`}>
          {toast.ok ? "✅ " : "⚠️ "}{toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo href="/alerts" className="rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200" compact />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live Alerts</p>
              <p className="text-sm font-semibold text-slate-700">Order notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-mono text-sm tabular-nums text-slate-500">{clock}</span>
            <button onClick={() => setSoundOn((s) => !s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${soundOn ? "border-brand-gold bg-brand-gold text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              {soundOn ? "Sound On" : "Sound Off"}
            </button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`} />
              {connected ? "Connected" : "Connecting…"}
            </div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_360px] lg:gap-6 lg:p-6">

        {/* Alert stage */}
        <div className="relative flex min-h-[55vh] items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:min-h-[calc(100vh-132px)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(239,81,35,0.12),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(67,93,105,0.08),_transparent_28%)]" />
          {!active ? (
            <div className="relative text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-gold/10 text-4xl">🔔</div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Waiting for orders</p>
            </div>
          ) : (
            <div className="relative w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-9">
              <div className="mb-5 h-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-navy to-brand-gold" />
              <button onClick={() => setActive(null)}
                className="float-right rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">Dismiss</button>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-brand-gold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-gold" /> New Order Received
              </div>
              <div className="mb-1 text-4xl font-black text-slate-900">{active.order_number}</div>
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-bold uppercase text-white" style={{ background: orderStatusColor(active.status) }}>
                  {orderStatusLabel(active.status)}
                </span>
              </div>

              <div className="mb-5 flex gap-4">
                <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Total</div>
                  <div className="text-2xl font-bold text-brand-gold">{formatPrice(active.total)}</div>
                </div>
                <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Items</div>
                  <div className="text-2xl font-bold text-slate-900">{active.items.reduce((s, i) => s + i.quantity, 0)}</div>
                </div>
              </div>

              {/* Items with qty editing */}
              <div className="mb-4 border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Items</p>
                {active.items.map((item) => {
                  const pendingQty = editQty[item.id] ?? item.quantity;
                  const isDirty = pendingQty !== item.quantity;
                  return (
                    <div key={item.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-900 flex-1">{item.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditQty(prev => ({ ...prev, [item.id]: Math.max(1, (prev[item.id] ?? item.quantity) - 1) }))}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:border-brand-navy hover:text-brand-navy">−</button>
                        <span className={`w-6 text-center text-sm font-bold ${isDirty ? "text-brand-primary" : "text-slate-900"}`}>{pendingQty}</span>
                        <button onClick={() => setEditQty(prev => ({ ...prev, [item.id]: (prev[item.id] ?? item.quantity) + 1 }))}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:border-brand-navy hover:text-brand-navy">+</button>
                        {isDirty && (
                          <>
                            <button onClick={() => updateQty(active, item, pendingQty)} disabled={!!updating}
                              className="ml-1 rounded-lg bg-brand-navy px-2 py-1 text-[0.65rem] font-bold text-white hover:bg-[#2d4a5a] disabled:opacity-50">
                              {updating === "qty" + item.id ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditQty(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.65rem] font-semibold text-slate-500 hover:bg-slate-100">
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {active.notes && <div className="mb-4 text-xs italic text-slate-500">Note: {active.notes}</div>}

              {/* Status buttons */}
              <div className="border-t border-slate-200 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Update Status & Notify Customer</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ACTIONS.filter(a => a.status !== active.status).map(({ status, label, color, hoverColor }) => (
                    <button key={status} disabled={!!updating}
                      onClick={() => updateStatus(active, status)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold tracking-wide transition disabled:opacity-50 ${color} ${hoverColor}`}>
                      {updating === active.id + status ? "…" : label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Orders</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button onClick={() => setFilter("active")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${filter === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Active</button>
              <button onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${filter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>All</button>
            </div>
          </div>
          <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-3">
            {visibleOrders.length === 0 ? (
              <p className="mt-10 text-center text-sm text-slate-500">{filter === "active" ? "No active orders." : "No orders yet."}</p>
            ) : visibleOrders.map((o) => (
              <div key={o.id} className="mb-2 cursor-pointer rounded-2xl border border-slate-200 p-3 transition hover:border-brand-gold hover:bg-brand-gold/5" onClick={() => setActive(o)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">{o.order_number}</div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase text-white"
                    style={{ background: orderStatusColor(o.status) }}>
                    {orderStatusLabel(o.status)}
                  </span>
                </div>
                <div className="mb-2 text-xs text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-gold">{formatPrice(o.total)}</span>
                  <span className="text-xs text-slate-400">{o.items?.length ?? 0} line{o.items?.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                  {STATUS_ACTIONS.filter(a => a.status !== o.status).map(({ status, label, color, hoverColor }) => (
                    <button key={status} disabled={!!updating}
                      onClick={() => updateStatus(o, status)}
                      className={`rounded-lg px-2 py-1 text-[0.6rem] font-bold transition disabled:opacity-50 ${color} ${hoverColor}`}>
                      {updating === o.id + status ? "…" : label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
