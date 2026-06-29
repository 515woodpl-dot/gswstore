"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import BrandLogo from "@/components/BrandLogo";
import type { Order } from "@/types";

export default function AlertsScreen({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [active, setActive] = useState<Order | null>(null);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [clock, setClock] = useState("");
  const soundRef = useRef(true);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = createClient();

  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

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

  // Realtime subscription
  useEffect(() => {
    const channel = sb
      .channel("alerts-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        const o = payload.new as Order;
        const { data: items } = await sb.from("order_items").select("*").eq("order_id", o.id);
        const full = { ...o, items: items ?? [] };
        setOrders((prev) => prev.some((p) => p.id === full.id) ? prev : [full, ...prev].slice(0, 30));
        showAlert(full);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const u = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === u.id ? { ...o, ...u } : o)));
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { sb.removeChannel(channel); };
  }, [sb, showAlert]);

  // Safety net — poll every 20s for any order realtime might have missed
  useEffect(() => {
    const poll = setInterval(async () => {
      const { data } = await sb
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data) return;
      setOrders((prev) => {
        const known = new Set(prev.map((o) => o.id));
        const fetched: Order[] = data.map((o) => ({ ...o, items: o.order_items }));
        const missed = fetched.filter((o) => !known.has(o.id));
        if (missed.length === 0) {
          // still merge status updates
          return prev.map((p) => {
            const fresh = fetched.find((f) => f.id === p.id);
            return fresh ? { ...p, status: fresh.status } : p;
          });
        }
        // a missed order arrived — surface the newest one
        showAlert(missed[0]);
        return [...missed, ...prev].slice(0, 30);
      });
    }, 20000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const STATUS_BG: Record<string, string> = {
    pending: "#451a03;color:#fbbf24", confirmed: "#172554;color:#93c5fd",
    ready: "#052e16;color:#86efac", completed: "#1e293b;color:#94a3b8", cancelled: "#450a0a;color:#fca5a5",
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(239,81,35,0.08),_transparent_30%),linear-gradient(180deg,_#fffdfb_0%,_#f6fbfc_52%,_#ffffff_100%)] text-slate-700">
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
              <div className="mb-6 text-slate-500">
                {active.items.length} item{active.items.length !== 1 ? "s" : ""}
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
              <div className="border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600">
                {active.items.map((i) => (
                  <div key={i.id}><span className="font-semibold text-slate-900">{i.name}</span> × {i.quantity}</div>
                ))}
              </div>
              {active.notes && <div className="mt-3 text-xs italic text-slate-500">Note: {active.notes}</div>}
            </div>
          )}
        </div>

        {/* History */}
        <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Recent Orders</div>
          <div className="max-h-[calc(100vh-150px)] overflow-y-auto p-3">
            {orders.length === 0 ? (
              <p className="mt-10 text-center text-sm text-slate-500">No orders yet.</p>
            ) : orders.map((o) => (
              <div key={o.id} className="mb-2 cursor-pointer rounded-2xl border border-slate-200 p-3 transition hover:border-brand-gold hover:bg-brand-gold/5" onClick={() => setActive(o)}>
                <div className="text-sm font-bold text-slate-900">{o.order_number}</div>
                <div className="mb-1 text-xs text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-gold">{formatPrice(o.total)}</span>
                  <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase" style={{ background: `#${STATUS_BG[o.status]?.split(";")[0]}`, color: STATUS_BG[o.status]?.split("color:")[1] }}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
