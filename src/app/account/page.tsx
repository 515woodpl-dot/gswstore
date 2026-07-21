import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserOrders, formatPrice, customerStatusMessage, SHOP_PHONE, SHOP_PHONE_RAW } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui";
import ReorderButton from "@/components/ReorderButton";
import CloseAccount from "@/components/CloseAccount";
import type { Order } from "@/types";

interface Props { searchParams: Promise<{ placed?: string }> }

export default async function OrdersPage({ searchParams }: Props) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/account/orders");
  const { placed } = await searchParams;
  let orders: Order[] = [];
  try { orders = await getUserOrders(user.id, sb); } catch {}

  const hasPendingOrders = orders.some((o) =>
    ["pending", "confirmed", "ready"].includes(o.status)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Account</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">My Orders</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Back to Catalog</Link>
      </div>

      {placed && (
        <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          Order <span className="font-bold">{placed}</span> has been received and added to your pickup history.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-slate-950">No orders yet.</p>
          <p className="mt-2 text-sm text-slate-600">Place an order to populate this account view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Order {order.order_number}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <p className="text-xl font-black tracking-tight text-slate-950">{formatPrice(order.total)}</p>
                  <ReorderButton items={order.items} userId={user.id} />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{item.name} × {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-slate-950">{formatPrice(item.unit_price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              {order.notes && (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-800">Your note:</span> {order.notes}
                </div>
              )}
              {(() => {
                const msg = customerStatusMessage(order.status, order.attention_note);
                const toneCls = {
                  info:    "border-sky-200 bg-sky-50 text-sky-900",
                  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
                  warning: "border-amber-300 bg-amber-50 text-amber-900",
                  muted:   "border-slate-200 bg-slate-50 text-slate-700",
                }[msg.tone];
                return (
                  <div className={`mt-4 rounded-2xl border px-4 py-3 ${toneCls}`}>
                    <p className="text-sm font-bold">{msg.title}</p>
                    <p className="mt-1 text-sm leading-6">{msg.body}</p>
                    {msg.tone === "warning" && (
                      <a href={`tel:${SHOP_PHONE_RAW}`} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
                        📞 Call {SHOP_PHONE}
                      </a>
                    )}
                  </div>
                );
              })()}
            </article>
          ))}
        </div>
      )}

      <CloseAccount hasPendingOrders={hasPendingOrders} userEmail={user.email ?? ""} />
    </div>
  );
}
