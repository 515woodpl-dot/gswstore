"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { createOrder, formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui";

export default function CheckoutPage() {
  const { cart, total, refresh } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const items = cart?.items ?? [];
  const PLACEHOLDER = "https://placehold.co/64x64/1e3a5f/ffffff?text=GST";

  if (items.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Checkout</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Nothing to checkout yet.</h1>
      <Link href="/" className="mt-8 inline-flex rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white">Browse Products</Link>
    </div>
  );

  async function handlePlaceOrder() {
    if (!user || !cart) return;
    setPlacing(true); setError("");
    try {
      const order = await createOrder(user.id, cart, notes);
      await refresh();
      fetch("/api/orders/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id }) }).catch(() => {});
      router.push(`/account/orders?placed=${order.order_number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed. Please try again.");
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Checkout</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Order review</h1>
        </div>
        <OrderStatusBadge status="pending" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Review your order</h2>
            <div className="mt-4 divide-y divide-slate-200">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url || PLACEHOLDER} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">{item.name}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{formatPrice(item.store_price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Pickup note</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Orders are collected in store only. Use the notes field below to share any counter instructions.</p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Optional notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                placeholder="Example: Please hold the order until after 3 PM."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" />
            </label>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Total</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-950">{formatPrice(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Pickup</span>
              <span className="font-semibold text-emerald-700">Free</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Grand total</span>
              <span className="text-2xl font-black tracking-tight text-slate-950">{formatPrice(total)}</span>
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <button type="button" onClick={handlePlaceOrder} disabled={placing}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70">
            {placing ? "Placing Order..." : "Place Order"}
          </button>
          <Link href="/cart" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
            Back to Cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
