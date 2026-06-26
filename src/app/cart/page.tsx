"use client";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { cart, itemCount, total, loading, updateQty, removeItem } = useCart();
  const { user } = useAuth();

  if (loading) return <div className="container py-5 text-center text-muted"><p>Loading cart…</p></div>;

  if (!user) return (
    <div className="container py-5 text-center">
      <h2 className="mb-3">Sign in to view your cart</h2>
      <Link href="/auth/login?next=/cart" className="btn btn-dark me-2">Sign In</Link>
      <Link href="/auth/register" className="btn btn-outline-dark">Create Account</Link>
    </div>
  );

  const items = cart?.items ?? [];
  if (items.length === 0) return (
    <div className="container py-5 text-center">
      <h2 className="mb-3">Your cart is empty</h2>
      <Link href="/" className="btn btn-dark">Browse Products</Link>
    </div>
  );

  return (
    <div className="container py-4">
      <h1 className="font-weight-bold mb-4">Cart <span className="text-muted text-4 font-weight-normal">({itemCount} items)</span></h1>
      <div className="row g-4">
        <div className="col-lg-8">
          {items.map(item => (
            <div key={item.id} className="d-flex gap-3 py-3" style={{ borderBottom: "1px solid #e9ecef" }}>
              <div style={{ width: 80, height: 80, background: "#f8f9fa", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url || "/img/products/product-grey-1.jpg"} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
              </div>
              <div className="flex-grow-1">
                <Link href={`/shop/product/${item.item_id}`} className="text-color-dark font-weight-semibold text-decoration-none">{item.name}</Link>
                {item.sku && <p className="text-muted mb-1 text-2">SKU: {item.sku}</p>}
                <div className="d-flex align-items-center gap-3 mt-2">
                  <div className="input-group" style={{ width: 110 }}>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                    <span className="form-control form-control-sm text-center" style={{ lineHeight:"30px", padding:0 }}>{item.quantity}</span>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <button className="btn btn-link text-danger p-0 text-2" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </div>
              <div className="text-end" style={{ flexShrink:0 }}>
                <p className="mb-0 font-weight-bold">{formatPrice(item.store_price * item.quantity)}</p>
                {item.quantity > 1 && <p className="text-muted mb-0 text-2">{formatPrice(item.store_price)} each</p>}
              </div>
            </div>
          ))}
          <div className="mt-3"><Link href="/" className="text-color-dark text-decoration-none text-3">&larr; Continue Shopping</Link></div>
        </div>
        <div className="col-lg-4">
          <div className="p-4 rounded" style={{ background:"#f8f9fa", border:"1px solid #e9ecef", position:"sticky", top:20 }}>
            <h5 className="font-weight-bold mb-3">Order Summary</h5>
            <div className="d-flex justify-content-between mb-2 text-3"><span className="text-muted">Subtotal</span><span>{formatPrice(total)}</span></div>
            <div className="d-flex justify-content-between mb-2 text-3"><span className="text-muted">Pickup</span><span className="text-success">Free</span></div>
            <hr />
            <div className="d-flex justify-content-between mb-4"><strong>Total</strong><strong className="text-5">{formatPrice(total)}</strong></div>
            <Link href="/checkout" className="btn btn-primary w-100 btn-modern" style={{ padding:"12px" }}>Proceed to Checkout</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
