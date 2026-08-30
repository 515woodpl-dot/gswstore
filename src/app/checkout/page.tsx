"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { createOrder, formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui";
import SquareCardForm from "@/components/SquareCardForm";

export default function CheckoutPage() {
  const { cart, total, refresh } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [payMethod, setPayMethod] = useState<"pay_now" | "pay_later" | "saved_card">("pay_later");
  const [savedCards, setSavedCards] = useState<{ square_card_id: string; brand: string; last_4: string; exp_month: number; exp_year: number }[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [cardPayError, setCardPayError] = useState("");
  const [address, setAddress] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; name: string; percentOff: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const items = cart?.items ?? [];
  const FREE_DELIVERY_THRESHOLD = 100;
  const qualifiesFreeDelivery = total >= FREE_DELIVERY_THRESHOLD;
  const promoDiscount = promo ? Math.round(total * (promo.percentOff / 100) * 100) / 100 : 0;
  const discountedSubtotal = total - promoDiscount;
  const taxAmount = taxRate != null ? Math.round(discountedSubtotal * taxRate * 100) / 100 : 0;
  const zipReady = customerZip.length === 5; // ZIP entered — allow checkout (tax may or may not apply)

  // 3% + $0.30 processing fee on the taxed subtotal — only when paying by card
  const cardFee = payMethod !== "pay_later" ? Math.round(((discountedSubtotal + taxAmount) * 0.03 + 0.30) * 100) / 100 : 0;
  const chargeTotal = discountedSubtotal + taxAmount + cardFee;

  async function applyPromo() {
    setPromoError("");
    const response = await fetch("/api/discount-codes/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoInput }) });
    const data = await response.json();
    if (!response.ok) { setPromo(null); setPromoError(data.error || "Code could not be applied."); return; }
    setPromo({ code: data.code, name: data.name, percentOff: data.percentOff });
  }

  async function lookupTax(zip: string) {
    const clean = zip.trim();
    if (clean.length !== 5 || !/^\d{5}$/.test(clean)) { setTaxRate(null); return; }
    setTaxLoading(true);
    try {
      const res = await fetch(`/api/admin/tax-rates?zip=${clean}`);
      if (res.ok) { const d = await res.json(); setTaxRate(d.combined_rate ?? null); }
      else setTaxRate(null);
    } catch { setTaxRate(null); }
    setTaxLoading(false);
  }

  // Load saved cards when user is available
  useEffect(() => {
    if (!user) return;
    fetch("/api/square/cards")
      .then((r) => r.json())
      .then((j) => {
        if (j.cards?.length) {
          setSavedCards(j.cards);
          setSelectedCard(j.cards[0].square_card_id);
          setPayMethod("saved_card");
        }
      })
      .catch(() => {});
  }, [user]);
  const PLACEHOLDER = "https://placehold.co/64x64/1e3a5f/ffffff?text=GST";

  if (items.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Checkout</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Nothing to checkout yet.</h1>
      <Link href="/" className="mt-8 inline-flex w-full justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white sm:w-auto">Browse Products</Link>
    </div>
  );

  async function placeOrder(paymentId?: string) {
    if (!user || !cart) return;
    if (fulfillment === "delivery" && !address.trim()) {
      setError("Please enter a delivery address.");
      return;
    }
    setPlacing(true); setError(""); setCardPayError("");
    try {
      const taxNote = taxRate != null && taxAmount > 0
        ? ` · Tax (${customerZip} ${(taxRate * 100).toFixed(2)}%): ${formatPrice(taxAmount)}`
        : "";
      const orderNotes = paymentId
        ? `${notes}${notes ? " · " : ""}[Paid online · Square ${paymentId}${cardFee > 0 ? ` · incl. ${formatPrice(cardFee)} processing fee` : ""}${taxNote}]`
        : `${notes}${taxNote}`;
      const order = await createOrder(user.id, cart, orderNotes, fulfillment, address, promo ? { code: promo.code, percentOff: promo.percentOff } : undefined);
      await refresh();
      fetch("/api/orders/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id }) })
        .then((r) => { if (!r.ok) console.error("[Checkout] notify failed:", r.status); })
        .catch((e) => console.error("[Checkout] notify error:", e));
      router.push(`/account/orders?placed=${order.order_number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed. Please try again.");
      setPlacing(false);
    }
  }

  async function handleSavedCardPay() {
    if (!selectedCard || !cart) return;
    setCardPayError(""); setPlacing(true);
    try {
      const res = await fetch("/api/square/charge-saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squareCardId: selectedCard, amountCents: Math.round(chargeTotal * 100) }),
      });
      const json = await res.json();
      if (!res.ok) { setCardPayError(json.error || "Payment failed."); setPlacing(false); return; }
      await placeOrder(json.paymentId);
    } catch {
      setCardPayError("Payment failed. Please try again.");
      setPlacing(false);
    }
  }

  function handlePlaceOrder() {
    placeOrder();
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">Your ZIP code</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Required</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Used to calculate Washington sales tax. Must match your card's billing ZIP.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={customerZip}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setCustomerZip(v);
                  if (v.length === 5) lookupTax(v);
                  else setTaxRate(null);
                }}
                placeholder="98198"
                inputMode="numeric"
                maxLength={5}
                className={`w-32 rounded-2xl border bg-white px-4 py-3 text-sm font-mono outline-none transition ${customerZip.length === 5 && taxRate != null ? "border-emerald-400 focus:border-emerald-500" : "border-slate-300 focus:border-brand-navy"}`}
              />
              {taxLoading && <span className="text-xs text-slate-400">Looking up rate…</span>}
              {!taxLoading && taxRate != null && customerZip.length === 5 && (
                <span className="text-sm font-semibold text-emerald-700">✓ {(taxRate * 100).toFixed(2)}% sales tax</span>
              )}
              {!taxLoading && taxRate === null && customerZip.length === 5 && (
                <span className="text-xs text-amber-700">ZIP not found — no tax applied</span>
              )}
            </div>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-bold text-slate-800">Discount code</p>
              <div className="mt-2 flex gap-2"><input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="WELCOME" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono uppercase" /><button type="button" onClick={applyPromo} className="rounded-xl bg-brand-navy px-3 py-2 text-sm font-bold text-white">Apply</button></div>
              {promo && <p className="mt-2 text-xs font-bold text-emerald-700">{promo.name}: {promo.percentOff}% off · −{formatPrice(promoDiscount)}</p>}
              {promoError && <p className="mt-2 text-xs font-semibold text-rose-700">{promoError}</p>}
            </div>
            {promo && <div className="flex items-center justify-between text-sm text-emerald-700"><span>{promo.code} ({promo.percentOff}% off)</span><span className="font-semibold">−{formatPrice(promoDiscount)}</span></div>}
            {cardFee > 0 && (
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Processing fee (3% + $0.30)</span>
                <span className="font-semibold text-slate-950">{formatPrice(cardFee)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Sales tax ({customerZip} · {taxRate != null ? `${(taxRate * 100).toFixed(2)}%` : ""})</span>
                <span className="font-semibold text-slate-950">{formatPrice(taxAmount)}</span>
              </div>
            )}
            {!customerZip && (
              <p className="text-xs text-amber-700">Enter your ZIP above to calculate sales tax.</p>
            )}
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
              <span className="text-2xl font-black tracking-tight text-slate-950">{formatPrice(chargeTotal)}</span>
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {/* Payment method */}
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Payment</p>

            {/* Saved cards */}
            {savedCards.length > 0 && savedCards.map((card) => (
              <button key={card.square_card_id} type="button"
                onClick={() => { setPayMethod("saved_card"); setSelectedCard(card.square_card_id); }}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition ${payMethod === "saved_card" && selectedCard === card.square_card_id ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
                <span className="font-semibold text-slate-900">💳 {card.brand} ···· {card.last_4} <span className="text-xs text-slate-400">exp {card.exp_month}/{card.exp_year}</span></span>
                {payMethod === "saved_card" && selectedCard === card.square_card_id && <span className="text-brand-navy">●</span>}
              </button>
            ))}

            <button type="button" onClick={() => setPayMethod("pay_now")}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition ${payMethod === "pay_now" ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
              <span className="font-semibold text-slate-900">💳 Pay with a new card</span>
              {payMethod === "pay_now" && <span className="text-brand-navy">●</span>}
            </button>
            <button type="button" onClick={() => setPayMethod("pay_later")}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition ${payMethod === "pay_later" ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 hover:border-slate-300"}`}>
              <span className="font-semibold text-slate-900">Pay at pickup / on delivery</span>
              {payMethod === "pay_later" && <span className="text-brand-navy">●</span>}
            </button>
          </div>

          {payMethod === "pay_now" ? (
            <div className="mt-4">
              {fulfillment === "delivery" && !address.trim() ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Enter your delivery address above to pay by card.</p>
              ) : (
                <SquareCardForm
                  amountCents={Math.round(chargeTotal * 100)}
                  disabled={placing || !zipReady}
                  prefillZip={customerZip}
                  onPaid={(paymentId) => placeOrder(paymentId)}
                />
              )}
            </div>
          ) : payMethod === "saved_card" ? (
            <div className="mt-4">
              {cardPayError && <p className="mb-2 text-sm text-rose-600">{cardPayError}</p>}
              <button type="button" onClick={handleSavedCardPay} disabled={placing || !zipReady}
                className="w-full rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
                {placing ? "Processing…" : `Pay $${chargeTotal.toFixed(2)} with saved card`}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                Or <button onClick={() => setPayMethod("pay_now")} className="underline">use a different card</button>
              </p>
            </div>
          ) : (
            <>
              <button type="button" onClick={handlePlaceOrder} disabled={placing || !zipReady}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                {placing ? "Placing Order..." : "Place Order"}
              </button>
              {!zipReady && (
                <p className="mt-2 text-center text-xs text-amber-700">Enter your ZIP code above to continue.</p>
              )}
            </>
          )}
          <Link href="/cart" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
            Back to Cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
