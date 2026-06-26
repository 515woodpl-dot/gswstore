"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { createOrder } from "@/lib/orders";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const { cart, total, refresh } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted mb-3">Your cart is empty.</p>
        <Link href="/shop" className="btn btn-dark">Browse Products</Link>
      </div>
    );
  }

  async function handlePlaceOrder() {
    if (!user || !cart) return;
    setSubmitting(true);
    setError("");

    try {
      const order = await createOrder(user.id, cart, notes);
      await refresh();
      router.push(`/account/orders?placed=${order.order_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container">
        <h1 className="mb-4" style={{ fontSize: "1.75rem", fontWeight: 700 }}>Checkout</h1>

        <div className="row g-4">
          {/* Left: Review + notes */}
          <div className="col-lg-7">
            <div className="p-4 rounded mb-4" style={{ border: "1px solid #e9ecef" }}>
              <h5 className="mb-3 fw-bold">Review Your Order</h5>

              {items.map((item) => (
                <div key={item.id} className="d-flex gap-3 py-2" style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ flexShrink: 0, width: 56, height: 56, background: "#f8f9fa", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} fill sizes="56px" style={{ objectFit: "contain", padding: "4px" }} />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100">
                        <i className="fas fa-image text-muted" style={{ fontSize: "0.75rem" }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow-1">
                    <p className="mb-0 fw-semibold" style={{ fontSize: "0.9rem" }}>{item.name}</p>
                    <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>Qty: {item.quantity}</p>
                  </div>
                  <p className="mb-0 fw-semibold" style={{ fontSize: "0.9rem" }}>{formatPrice(item.store_price * item.quantity)}</p>
                </div>
              ))}
            </div>

            {/* Pickup note */}
            <div className="p-4 rounded mb-4" style={{ background: "#f0f7ff", border: "1px solid #bee3f8" }}>
              <div className="d-flex align-items-start gap-2">
                <i className="fas fa-store text-primary mt-1" />
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>In-store pickup</strong>
                  <p className="mb-0 text-muted" style={{ fontSize: "0.8rem" }}>
                    We will send you a notification when your order is ready for collection. No delivery available at this time.
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="form-label fw-semibold" style={{ fontSize: "0.875rem" }}>
                Order notes <span className="text-muted fw-normal">(optional)</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Any special requests or questions about your order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ fontSize: "0.875rem" }}
              />
            </div>
          </div>

          {/* Right: Summary */}
          <div className="col-lg-5">
            <div className="p-4 rounded" style={{ background: "#f8f9fa", border: "1px solid #e9ecef", position: "sticky", top: 20 }}>
              <h5 className="mb-3 fw-bold">Order Total</h5>

              <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                <span className="text-muted">Subtotal ({items.length} items)</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                <span className="text-muted">Pickup</span>
                <span className="text-success fw-semibold">Free</span>
              </div>

              <div style={{ height: 1, background: "#dee2e6", margin: "12px 0" }} />

              <div className="d-flex justify-content-between mb-4">
                <span className="fw-bold">Total</span>
                <span className="fw-bold" style={{ fontSize: "1.4rem" }}>{formatPrice(total)}</span>
              </div>

              {error && (
                <div className="alert alert-danger py-2 mb-3" style={{ fontSize: "0.85rem" }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-dark w-100 mb-2"
                onClick={handlePlaceOrder}
                disabled={submitting}
                style={{ padding: "14px", fontSize: "0.95rem", fontWeight: 600 }}
              >
                {submitting ? "Placing Order…" : "Place Order"}
              </button>

              <Link href="/cart" className="btn btn-outline-secondary w-100" style={{ fontSize: "0.875rem" }}>
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
