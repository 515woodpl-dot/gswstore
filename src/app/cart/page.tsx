"use client";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { QuantitySelector, StockBadge } from "@/components/ui";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { cart, itemCount, total, loading, updateQty, removeItem } = useCart();
  const { user } = useAuth();

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8"><p className="text-slate-500">Loading cart…</p></div>;

  if (!user) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Cart</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Sign in to view your cart</h1>
      <p className="mt-3 text-slate-600">Your cart is saved to your account.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/auth/login?next=/cart" className="inline-flex rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white">Sign In</Link>
        <Link href="/auth/register" className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800">Create Account</Link>
      </div>
    </div>
  );

  const items = cart?.items ?? [];

  if (items.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Cart</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Your cart is empty.</h1>
      <p className="mt-3 text-slate-600">Add a few trade essentials from the catalog to continue.</p>
      <Link href="/" className="mt-8 inline-flex rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white">Browse Products</Link>
    </div>
  );

  const PLACEHOLDER = "https://placehold.co/128x96/1e3a5f/ffffff?text=GST";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Cart</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Review your items</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Continue shopping</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="w-full overflow-hidden rounded-2xl bg-slate-50 sm:w-32 sm:flex-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url || PLACEHOLDER} alt={item.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-950">{item.name}</h2>
                      <p className="text-sm text-slate-500">{item.sku}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <QuantitySelector value={item.quantity} onChange={(v) => updateQty(item.id, v)} />
                    <button type="button" onClick={() => removeItem(item.id)} className="text-sm font-semibold text-rose-600 transition hover:text-rose-700">Remove</button>
                  </div>
                </div>
                <div className="flex items-end justify-between sm:flex-col sm:items-end sm:justify-between">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Line total</p>
                    <p className="text-2xl font-bold text-slate-950">{formatPrice(item.store_price * item.quantity)}</p>
                  </div>
                  <p className="text-xs font-medium text-slate-500">{formatPrice(item.store_price)} each</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Order Summary</p>
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
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Total</span>
              <span className="text-2xl font-black tracking-tight text-slate-950">{formatPrice(total)}</span>
            </div>
          </div>
          <Link href="/checkout" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Proceed to Checkout
          </Link>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
            Every order is held for in-store pickup only. No shipping address required.
          </div>
        </aside>
      </div>
    </div>
  );
}
