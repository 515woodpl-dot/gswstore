import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdmin } from "@/lib/admin";
import { logOrderEvent } from "@/lib/order-events";
import { sendPaymentRequestEmail } from "@/lib/notifications";
import { cancelPaymentLink, createPaymentLink } from "@/lib/square-checkout";
import type { CustomerRow } from "@/lib/admin-order-types";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = adminClient();

  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId." }, { status: 400 });

    const { data: order } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    let paymentLinkUrl: string | null = order.square_payment_link_status === "active" ? order.square_payment_link_url : null;
    let regenerated = false;
    if (!paymentLinkUrl) {
      if (!["unpaid", "failed"].includes(order.payment_status) || order.status !== "awaiting_payment") {
        return NextResponse.json({ error: "This order cannot generate a new payment link." }, { status: 409 });
      }
      const activeItems = order.order_items.filter((item: { quantity: number; cancelled_quantity?: number }) => Number(item.quantity) > Number(item.cancelled_quantity || 0));
      if (!activeItems.length) return NextResponse.json({ error: "This order has no active items." }, { status: 409 });

      const squareLineItems = activeItems.flatMap((item: { name: string; quantity: number; cancelled_quantity?: number; net_amount?: number; unit_price: number }) => {
        const quantity = Number(item.quantity) - Number(item.cancelled_quantity || 0);
        const cents = Math.round(Number(item.net_amount ?? item.unit_price * item.quantity) * 100 * quantity / Number(item.quantity));
        const low = Math.floor(cents / quantity);
        const highCount = cents - low * quantity;
        return [
          ...(highCount ? [{ name: item.name, quantity: String(highCount), basePriceMoneyCents: low + 1 }] : []),
          ...(quantity - highCount ? [{ name: item.name, quantity: String(quantity - highCount), basePriceMoneyCents: low }] : []),
        ];
      });
      const taxCents = activeItems.reduce((sum: number, item: { quantity: number; cancelled_quantity?: number; tax_amount?: number }) => (
        sum + Math.round(Number(item.tax_amount || 0) * 100 * (Number(item.quantity) - Number(item.cancelled_quantity || 0)) / Number(item.quantity))
      ), 0);
      if (taxCents > 0) squareLineItems.push({ name: "Sales Tax", quantity: "1", basePriceMoneyCents: taxCents });
      const stateKey = activeItems.map((item: { id: string; cancelled_quantity?: number }) => `${item.id}:${item.cancelled_quantity || 0}`).join("|");
      const link = await createPaymentLink({
        idempotencyKey: createHash("sha256").update(`${order.id}:recovery:${stateKey}`).digest("hex").slice(0, 45),
        referenceId: order.order_number,
        lineItems: squareLineItems,
        note: `Order ${order.order_number}`,
      }, order.is_test ? "sandbox" : "production");
      const { error: linkError } = await admin.from("orders").update({
        square_order_id: link.squareOrderId,
        square_payment_link_id: link.paymentLinkId,
        square_payment_link_url: link.url,
        square_payment_link_status: "active",
        payment_status: "unpaid",
        payment_link_sent_at: new Date().toISOString(),
      }).eq("id", orderId);
      if (linkError) {
        await cancelPaymentLink(link.paymentLinkId, order.is_test ? "sandbox" : "production");
        throw new Error(`Square created a link that could not be saved, so it was deactivated: ${linkError.message}`);
      }
      paymentLinkUrl = link.url;
      regenerated = true;
    }

    const { data: customer }: { data: CustomerRow | null } = order.walk_in_customer_id
      ? await admin.from("walk_in_customers").select("name,email").eq("id", order.walk_in_customer_id).single()
      : { data: null };
    if (!customer?.email) return NextResponse.json({ error: "No customer email on file." }, { status: 409 });

    await sendPaymentRequestEmail({ ...order, items: order.order_items }, customer.email, customer.name, paymentLinkUrl, regenerated);

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
    await logOrderEvent(admin, { orderId, eventType: "payment_email_sent", actorId: auth.userId, actorName, reason: "Resent by admin" });

    return NextResponse.json({ ok: true, sentTo: customer.email, regenerated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resend the payment link.";
    console.error("[ResendLink]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
