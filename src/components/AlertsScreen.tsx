"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
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
  function playChime() {
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
  }

  function showAlert(order: Order) {
    setActive(order);
    playChime();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setActive(null), 30000);
  }

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
  }, [sb]);

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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-blue-500 bg-[#1e3a5f] px-6 py-3">
        <div className="text-xl font-black tracking-wide">GSW<span className="text-blue-400">.</span> Orders</div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm tabular-nums text-slate-300">{clock}</span>
          <button onClick={() => setSoundOn((s) => !s)}
            className={`rounded-md border px-3 py-1 text-xs font-semibold ${soundOn ? "border-blue-400 text-blue-300" : "border-slate-600 text-slate-400"}`}>
            {soundOn ? "🔔 Sound On" : "🔕 Sound Off"}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            <span className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`} />
            {connected ? "Connected" : "Connecting…"}
          </div>
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[1fr_360px]">
        {/* Alert stage */}
        <div className="relative flex items-center justify-center p-10">
          {!active ? (
            <div className="text-center opacity-40">
              <div className="mx-auto mb-4 text-7xl">🔔</div>
              <p className="text-sm text-slate-400">Waiting for orders…</p>
            </div>
          ) : (
            <div className="w-full max-w-xl rounded-3xl border-2 border-emerald-500 bg-slate-800 p-9 shadow-[0_0_60px_rgba(34,197,94,0.2)]">
              <button onClick={() => setActive(null)}
                className="float-right rounded-md border border-slate-600 bg-white/5 px-3 py-1 text-xs text-slate-300">Dismiss</button>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> New Order Received
              </div>
              <div className="mb-1 text-4xl font-black">{active.order_number}</div>
              <div className="mb-6 text-slate-400">
                {active.items.length} item{active.items.length !== 1 ? "s" : ""}
              </div>
              <div className="mb-5 flex gap-4">
                <div className="flex-1 rounded-xl border border-slate-700 bg-white/5 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</div>
                  <div className="text-2xl font-bold text-emerald-400">{formatPrice(active.total)}</div>
                </div>
                <div className="flex-1 rounded-xl border border-slate-700 bg-white/5 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Items</div>
                  <div className="text-2xl font-bold">{active.items.reduce((s, i) => s + i.quantity, 0)}</div>
                </div>
              </div>
              <div className="border-t border-slate-700 pt-4 text-sm leading-7 text-slate-300">
                {active.items.map((i) => (
                  <div key={i.id}><span className="font-semibold text-white">{i.name}</span> × {i.quantity}</div>
                ))}
              </div>
              {active.notes && <div className="mt-3 text-xs italic text-slate-400">Note: {active.notes}</div>}
            </div>
          )}
        </div>

        {/* History */}
        <aside className="border-l border-slate-800 bg-[#111827]">
          <div className="border-b border-slate-800 px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Recent Orders</div>
          <div className="max-h-[calc(100vh-110px)] overflow-y-auto p-3">
            {orders.length === 0 ? (
              <p className="mt-10 text-center text-sm text-slate-500">No orders yet.</p>
            ) : orders.map((o) => (
              <div key={o.id} className="mb-2 cursor-pointer rounded-lg border border-slate-700 p-3 transition hover:bg-slate-800" onClick={() => setActive(o)}>
                <div className="text-sm font-bold">{o.order_number}</div>
                <div className="mb-1 text-xs text-slate-400">{new Date(o.created_at).toLocaleTimeString()}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-400">{formatPrice(o.total)}</span>
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
