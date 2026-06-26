import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserOrders } from "@/lib/orders";
import { formatPrice, orderStatusLabel, orderStatusColor } from "@/lib/format";
import type { Order } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Orders" };

interface Props {
  searchParams: Promise<{ placed?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/account/orders");

  const { placed } = await searchParams;

  let orders: Order[] = [];
  try {
    orders = await getUserOrders(user.id);
  } catch {
    // db error
  }

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="d-flex align-items-center gap-3 mb-4">
          <Link href="/account" className="text-dark text-decoration-none" style={{ fontSize: "0.875rem" }}>
            &larr; Account
          </Link>
          <h1 className="mb-0" style={{ fontSize: "1.75rem", fontWeight: 700 }}>My Orders</h1>
        </div>

        {/* Success banner after placing order */}
        {placed && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-4" style={{ fontSize: "0.9rem" }}>
            <i className="fas fa-check-circle" />
            <div>
              <strong>Order placed!</strong> Order <strong>{placed}</strong> has been received. We will notify you when it is ready for pickup.
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-box-open mb-3" style={{ fontSize: "3rem", color: "#dee2e6" }} />
            <p className="text-muted mb-3">No orders yet.</p>
            <Link href="/shop" className="btn btn-dark btn-sm">Start Shopping</Link>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {orders.map((order) => (
              <div key={order.id} className="p-4 rounded" style={{ border: "1px solid #e9ecef" }}>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                  <div>
                    <p className="mb-0 fw-bold" style={{ fontSize: "0.95rem" }}>Order {order.order_number}</p>
                    <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>
                      {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <span className="badge" style={{ background: orderStatusColor(order.status), fontSize: "0.75rem", padding: "5px 10px" }}>
                      {orderStatusLabel(order.status)}
                    </span>
                    <span className="fw-bold">{formatPrice(order.total)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="d-flex flex-column gap-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="d-flex justify-content-between" style={{ fontSize: "0.85rem" }}>
                      <span className="text-muted">
                        {item.name}
                        <span className="ms-1">× {item.quantity}</span>
                      </span>
                      <span>{formatPrice(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p className="mt-2 mb-0 text-muted" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
                    Note: {order.notes}
                  </p>
                )}

                {order.status === "ready" && (
                  <div className="mt-3 p-2 rounded" style={{ background: "#d1fae5", fontSize: "0.85rem", color: "#065f46" }}>
                    <i className="fas fa-store me-1" />
                    Your order is ready for pickup!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
