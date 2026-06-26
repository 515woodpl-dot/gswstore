"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";

export default function CartPage() {
  const { cart, itemCount, total, loading, updateQty, removeItem } = useCart();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="container py-5 text-center text-muted">
        <p>Loading cart…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-5 text-center">
        <i className="fas fa-shopping-cart mb-3" style={{ fontSize: "3rem", color: "#dee2e6" }} />
        <h2 className="mb-3" style={{ fontSize: "1.5rem" }}>Sign in to view your cart</h2>
        <p className="text-muted mb-4">Your cart is saved to your account.</p>
        <Link href="/auth/login?next=/cart" className="btn btn-dark">Sign In</Link>
        <span className="mx-2 text-muted">or</span>
        <Link href="/auth/register" className="btn btn-outline-dark">Create Account</Link>
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="container py-5 text-center">
        <i className="fas fa-shopping-cart mb-3" style={{ fontSize: "3rem", color: "#dee2e6" }} />
        <h2 className="mb-3" style={{ fontSize: "1.5rem" }}>Your cart is empty</h2>
        <p className="text-muted mb-4">Add some products to get started.</p>
        <Link href="/shop" className="btn btn-dark">Browse Products</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container">
        <h1 className="mb-4" style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          Cart <span className="text-muted" style={{ fontSize: "1rem", fontWeight: 400 }}>({itemCount} items)</span>
        </h1>

        <div className="row g-4">
          {/* Items */}
          <div className="col-lg-8">
            {items.map((item) => (
              <div
                key={item.id}
                className="d-flex gap-3 py-3"
                style={{ borderBottom: "1px solid #e9ecef" }}
              >
                {/* Image */}
                <div style={{ flexShrink: 0, width: 80, height: 80, background: "#f8f9fa", borderRadius: 8, position: "relative", overflow: "hidden" }}>
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      sizes="80px"
                      style={{ objectFit: "contain", padding: "4px" }}
                    />
                  ) : (
                    <div className="d-flex align-items-center justify-content-center h-100">
                      <i className="fas fa-image text-muted" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-grow-1">
                  <Link href={`/shop/product/${item.item_id}`} className="text-dark text-decoration-none fw-semibold" style={{ fontSize: "0.95rem" }}>
                    {item.name}
                  </Link>
                  {item.sku && <p className="text-muted mb-1" style={{ fontSize: "0.75rem" }}>SKU: {item.sku}</p>}

                  <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                    {/* Qty */}
                    <div className="input-group" style={{ width: 110 }}>
                      <button className="btn btn-outline-secondary btn-sm"
                        onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                      <span className="form-control form-control-sm text-center" style={{ lineHeight: "30px", padding: 0 }}>
                        {item.quantity}
                      </span>
                      <button className="btn btn-outline-secondary btn-sm"
                        onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                    </div>

                    <button
                      className="btn btn-link text-danger p-0"
                      onClick={() => removeItem(item.id)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="text-end" style={{ flexShrink: 0 }}>
                  <p className="mb-0 fw-bold">{formatPrice(item.store_price * item.quantity)}</p>
                  {item.quantity > 1 && (
                    <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>{formatPrice(item.store_price)} each</p>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-3">
              <Link href="/shop" className="text-dark text-decoration-none" style={{ fontSize: "0.875rem" }}>
                &larr; Continue Shopping
              </Link>
            </div>
          </div>

          {/* Summary */}
          <div className="col-lg-4">
            <div className="p-4 rounded" style={{ background: "#f8f9fa", border: "1px solid #e9ecef", position: "sticky", top: 20 }}>
              <h5 className="mb-3" style={{ fontWeight: 700 }}>Order Summary</h5>

              <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                <span className="text-muted">Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                <span className="text-muted">Shipping</span>
                <span className="text-success fw-semibold">Free (pickup)</span>
              </div>

              <div style={{ height: 1, background: "#dee2e6", margin: "12px 0" }} />

              <div className="d-flex justify-content-between mb-4">
                <span className="fw-bold">Total</span>
                <span className="fw-bold" style={{ fontSize: "1.25rem" }}>{formatPrice(total)}</span>
              </div>

              <Link href="/checkout" className="btn btn-dark w-100" style={{ padding: "12px" }}>
                Proceed to Checkout
              </Link>

              <div className="mt-3 p-2 rounded text-center" style={{ background: "#e8f4ff", fontSize: "0.75rem", color: "#0d6efd" }}>
                <i className="fas fa-store me-1" />
                In-store pickup only
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
