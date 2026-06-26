import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserOrders, formatPrice, orderStatusLabel, orderStatusColor } from "@/lib/utils";
import type { Order } from "@/types";

interface Props { searchParams: Promise<{ placed?: string }> }

export default async function OrdersPage({ searchParams }: Props) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/account/orders");
  const { placed } = await searchParams;

  let orders: Order[] = [];
  try { orders = await getUserOrders(user.id); } catch {}

  return (
    <div className="container py-4" style={{ maxWidth:800 }}>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link href="/account" className="text-color-dark text-decoration-none text-3">&larr; Account</Link>
        <h1 className="font-weight-bold mb-0">My Orders</h1>
      </div>

      {placed && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-4 text-3">
          <i className="fas fa-check-circle" />
          <div><strong>Order placed!</strong> Order <strong>{placed}</strong> received. We will notify you when it is ready for pickup.</div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-5">
          <i className="fas fa-box-open mb-3" style={{ fontSize:"3rem", color:"#dee2e6" }} />
          <p className="text-muted mb-3">No orders yet.</p>
          <Link href="/" className="btn btn-dark btn-sm">Start Shopping</Link>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {orders.map(order => (
            <div key={order.id} className="p-4 rounded" style={{ border:"1px solid #e9ecef" }}>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <p className="mb-0 font-weight-bold text-3">Order {order.order_number}</p>
                  <p className="text-muted mb-0 text-2">{new Date(order.created_at).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</p>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <span className="badge" style={{ background: orderStatusColor(order.status), fontSize:"0.75rem", padding:"5px 10px" }}>{orderStatusLabel(order.status)}</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
              </div>
              {order.items.map(item => (
                <div key={item.id} className="d-flex justify-content-between text-3">
                  <span className="text-muted">{item.name} × {item.quantity}</span>
                  <span>{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              {order.status === "ready" && (
                <div className="mt-3 p-2 rounded text-3" style={{ background:"#d1fae5", color:"#065f46" }}>
                  <i className="fas fa-store me-1" /> Your order is ready for pickup!
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
