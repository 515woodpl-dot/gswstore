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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Account</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">My Orders</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/account/payment-methods" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            💳 Payment methods
          </Link>
          <Link href="/" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            ← Shop
          </Link>
        </div>
      </div>

      {placed && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ Order <span className="font-bold">{placed}</span> placed — we'll notify you when it's ready.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-slate-950">No orders yet.</p>
          <p className="mt-2 text-sm text-slate-500">Place an order and it will appear here.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const msg = customerStatusMessage(order.status, order.attention_note);
            const toneCls = {
              info:    "border-sky-200 bg-sky-50 text-sky-900",
              success: "border-emerald-200 bg-emerald-50 text-emerald-900",
              warning: "border-amber-300 bg-amber-50 text-amber-900",
              muted:   "border-slate-200 bg-slate-50 text-slate-700",
            }[msg.tone];

            return (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Order header */}
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{order.order_number}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <OrderStatusBadge status={order.status} />
                    <p className="text-base font-black text-slate-950">{formatPrice(order.total)}</p>
                    <ReorderButton items={order.items} userId={user.id} />
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5 border-t border-slate-100 px-4 py-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate font-medium text-slate-800">{item.name} × {item.quantity}</span>
                      <span className="shrink-0 font-semibold text-slate-700">{formatPrice(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Customer note */}
                {order.notes && (
                  <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    <span className="font-semibold">Your note:</span> {order.notes}
                  </div>
                )}

                {/* Status message */}
                <div className={`border-t ${toneCls} px-4 py-3`}>
                  <p className="text-sm font-bold">{msg.title}</p>
                  <p className="mt-0.5 text-sm leading-5" dangerouslySetInnerHTML={{ __html: msg.body }} />
                  {msg.tone === "warning" && (
                    <a href={`tel:${SHOP_PHONE_RAW}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
                      📞 Call {SHOP_PHONE}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CloseAccount hasPendingOrders={hasPendingOrders} userEmail={user.email ?? ""} />
    </div>
  );
}
