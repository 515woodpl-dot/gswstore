"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { createOrder, formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const { cart, total, refresh } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const items = cart?.items ?? [];

  if (items.length === 0) return (
    <div className="container py-5 text-center">
      <p className="text-muted mb-3">Your cart is empty.</p>
      <Link href="/" className="btn btn-dark">Browse Products</Link>
    </div>
  );

  async function handleOrder() {
    if (!user || !cart) return;
    setSubmitting(true); setError("");
    try {
      const order = await createOrder(user.id, cart, notes);
      await refresh();
      router.push(`/account/orders?placed=${order.order_number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-4">
      <h1 className="font-weight-bold mb-4">Checkout</h1>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="p-4 rounded mb-4" style={{ border:"1px solid #e9ecef" }}>
            <h5 className="font-weight-bold mb-3">Review Your Order</h5>
            {items.map(item => (
              <div key={item.id} className="d-flex gap-3 py-2" style={{ borderBottom:"1px solid #f0f0f0" }}>
                <div style={{ width:56, height:56, background:"#f8f9fa", flexShrink:0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url || "/img/products/product-grey-1.jpg"} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                </div>
                <div className="flex-grow-1">
                  <p className="mb-0 font-weight-semibold text-3">{item.name}</p>
                  <p className="text-muted mb-0 text-2">Qty: {item.quantity}</p>
                </div>
                <p className="mb-0 font-weight-semibold text-3">{formatPrice(item.store_price * item.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="p-3 rounded mb-4" style={{ background:"#f0f7ff", border:"1px solid #bee3f8", fontSize:"0.875rem" }}>
            <i className="fas fa-store text-primary me-2" />
            <strong>In-store pickup.</strong> We will notify you when your order is ready for collection.
          </div>
          <div className="mb-4">
            <label className="form-label font-weight-semibold text-3">Order notes <span className="text-muted font-weight-normal">(optional)</span></label>
            <textarea className="form-control" rows={3} placeholder="Any special requests…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="col-lg-5">
          <div className="p-4 rounded" style={{ background:"#f8f9fa", border:"1px solid #e9ecef", position:"sticky", top:20 }}>
            <h5 className="font-weight-bold mb-3">Order Total</h5>
            <div className="d-flex justify-content-between mb-2 text-3"><span className="text-muted">Subtotal</span><span>{formatPrice(total)}</span></div>
            <div className="d-flex justify-content-between mb-2 text-3"><span className="text-muted">Pickup</span><span className="text-success">Free</span></div>
            <hr />
            <div className="d-flex justify-content-between mb-4"><strong>Total</strong><strong className="text-6">{formatPrice(total)}</strong></div>
            {error && <div className="alert alert-danger py-2 mb-3 text-3">{error}</div>}
            <button className="btn btn-primary w-100 btn-modern mb-2" onClick={handleOrder} disabled={submitting} style={{ padding:"14px" }}>
              {submitting ? "Placing Order…" : "Place Order"}
            </button>
            <Link href="/cart" className="btn btn-outline-secondary w-100 btn-modern text-3">Back to Cart</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
