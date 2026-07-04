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
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const items = cart?.items ?? [];
  const FREE_DELIVERY_THRESHOLD = 100;
  const qualifiesFreeDelivery = total >= FREE_DELIVERY_THRESHOLD;
  const PLACEHOLDER = "https://placehold.co/64x64/1e3a5f/ffffff?text=GST";

  if (items.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Checkout</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Nothing to checkout yet.</h1>
      <Link href="/" className="mt-8 inline-flex w-full justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white sm:w-auto">Browse Products</Link>
    </div>
  );

  async function handlePlaceOrder() {
    if (!user || !cart) return;
    if (fulfillment === "delivery" && !address.trim()) {
      setError("Please enter a delivery address.");
      return;
    }
    setPlacing(true); setError("");
    try {
      const order = await createOrder(user.id, cart, notes, fulfillment, address);
      await refresh();
      fetch("/api/orders/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id }) }).catch(() => {});
      router.push(`/account/orders?placed=${order.order_number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed. Please try again.");
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Checkout</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Order review</h1>
        </div>
        <OrderStatusBadge status="pending" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">How would you like to receive your order?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setFulfillment("pickup")}
                className={`rounded-2xl border p-4 text-left transition ${fulfillment === "pickup" ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-bold text-slate-950">🏪 In-store Pickup</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">Free</p>
                <p className="mt-1 text-xs text-slate-500">Collect at our store counter.</p>
              </button>
              <button type="button" onClick={() => setFulfillment("delivery")}
                className={`rounded-2xl border p-4 text-left transition ${fulfillment === "delivery" ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-bold text-slate-950">🚚 Delivery</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {qualifiesFreeDelivery ? "Free (orders $100+)" : "Fee confirmed by our team"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {qualifiesFreeDelivery ? "Your order qualifies for free delivery." : "Add $100+ to qualify for free delivery."}
                </p>
              </button>
            </div>

            {fulfillment === "delivery" && (
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Delivery address</span>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} required
                  placeholder="Street address, city, state, ZIP"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" />
                {!qualifiesFreeDelivery && (
                  <span className="mt-2 block text-xs text-amber-700">A delivery fee will be confirmed by our team when your order is processed.</span>
                )}
              </label>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Order note</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Orders are collected in store only. Use the notes field below to share any counter instructions.</p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Optional notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                placeholder="Example: Please hold the order until after 3 PM."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-navy" />
            </label>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm lg:sticky lg:top-24 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Total</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-950">{formatPrice(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{fulfillment === "delivery" ? "Delivery" : "Pickup"}</span>
              <span className="font-semibold text-emerald-700">
                {fulfillment === "pickup" ? "Free" : qualifiesFreeDelivery ? "Free" : "TBD"}
              </span>
            </div>
            {fulfillment === "delivery" && !qualifiesFreeDelivery && (
              <p className="text-xs text-amber-700">Delivery fee confirmed by our team when processing.</p>
            )}
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
