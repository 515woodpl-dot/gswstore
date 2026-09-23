import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifySquareWebhookSignature, type SquareEnvironment } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { sendPaymentLinkConfirmationEmail } from "@/lib/notifications";
import { finalizeRefund } from "@/lib/refund-finalize";
import type { CustomerRow } from "@/lib/admin-order-types";

interface SquareWebhookEvent {
  event_id?: string;
  type?: string;
  data?: {
    object?: {
      payment?: {
        id: string;
        order_id?: string;
        status?: string;
        amount_money?: { amount?: number; currency?: string };
        receipt_url?: string | null;
      };
      refund?: {
        id: string;
        status?: string;
        reason?: string;
      };
    };
  };
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Square signs against the exact Notification URL configured in the Square
// Dashboard. Deployed behind a proxy, request.url can differ from that
// configured URL, so prefer an explicit env var when set.
function squareEnvironment(request: NextRequest): SquareEnvironment {
  return request.nextUrl.searchParams.get("environment") === "sandbox" ? "sandbox" : "production";
}

function notificationUrl(request: NextRequest, environment: SquareEnvironment): string {
  return environment === "sandbox"
    ? process.env.SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL || request.url
    : process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || request.url;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const environment = squareEnvironment(request);

  if (!verifySquareWebhookSignature(rawBody, signature, notificationUrl(request, environment), environment)) {
    console.warn("[SquareWebhook] invalid signature — rejecting");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventId: string | undefined = event.event_id;
  const eventType: string = event.type || "unknown";
  if (!eventId) return NextResponse.json({ error: "Missing event_id" }, { status: 400 });

  const admin = adminClient();

  const { data: claimed, error: claimError } = await admin.rpc("claim_square_webhook_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: event,
  });
  if (claimError) {
    console.error("[SquareWebhook] claim failed:", claimError.message);
    return NextResponse.json({ error: "Could not claim webhook" }, { status: 500 });
  }
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (eventType === "payment.updated" || eventType === "payment.created") {
      await handlePaymentEvent(admin, event);
    } else if (eventType === "refund.updated" || eventType === "refund.created") {
      await handleRefundEvent(admin, event);
    }
    // Unhandled event types are acknowledged and ignored.
    const { error: processedError } = await admin.from("square_webhook_events").update({
      processed_at: new Date().toISOString(), processing_started_at: null, process_error: null,
    }).eq("square_event_id", eventId);
    if (processedError) throw new Error(`Could not mark webhook processed: ${processedError.message}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[SquareWebhook] processing failed for ${eventType}:`, message);
    await admin.from("square_webhook_events").update({ process_error: message, processing_started_at: null }).eq("square_event_id", eventId);
    // Non-2xx so Square retries with backoff.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePaymentEvent(admin: ReturnType<typeof adminClient>, event: SquareWebhookEvent): Promise<void> {
  const payment = event.data?.object?.payment;
  if (!payment?.order_id) return;
  if (payment.status !== "COMPLETED") return; // only completed payments confirm an order

  const { data: order, error: orderLookupError } = await admin.from("orders").select("*, order_items(*)").eq("square_order_id", payment.order_id).maybeSingle();
  if (orderLookupError) throw new Error(`Could not look up payment order: ${orderLookupError.message}`);
  if (!order) {
    console.warn(`[SquareWebhook] no order found for square_order_id ${payment.order_id}`);
    return;
  }
  if (order.payment_status === "paid" || order.payment_status === "partially_refunded" || order.payment_status === "refunded") {
    return; // already confirmed — duplicate delivery, no-op
  }

  const amountPaidCents = payment.amount_money?.amount;
  const expectedCents = Math.round(Number(order.total) * 100);
  if (!Number.isInteger(amountPaidCents) || amountPaidCents !== expectedCents || payment.amount_money?.currency !== "USD") {
    throw new Error(`Payment ${payment.id} does not match order ${order.order_number}: expected USD ${expectedCents} cents.`);
  }
  const amountPaid = amountPaidCents / 100;
  const nowIso = new Date().toISOString();

  const { data: confirmed, error: confirmError } = await admin.from("orders").update({
    payment_status: "paid",
    status: order.status === "awaiting_payment" ? "processing" : order.status,
    square_payment_id: payment.id,
    square_receipt_url: payment.receipt_url ?? null,
    amount_paid: amountPaid,
    paid_at: nowIso,
    square_payment_link_status: order.square_payment_link_status === "active" ? "paid" : order.square_payment_link_status,
  }).eq("id", order.id).in("payment_status", ["unpaid", "pending", "failed"]).select("id").maybeSingle();
  if (confirmError) throw new Error(`Could not confirm payment: ${confirmError.message}`);
  if (!confirmed) return;

  await logOrderEvent(admin, {
    orderId: order.id, eventType: "payment_confirmed", squareRef: payment.id,
    newValue: { amountPaid },
  });

  const { data: customer }: { data: CustomerRow | null } = order.walk_in_customer_id
    ? await admin.from("walk_in_customers").select("name,email").eq("id", order.walk_in_customer_id).single()
    : { data: null };
  if (customer?.email) {
    const { data: fresh } = await admin.from("orders").select("*, order_items(*)").eq("id", order.id).single();
    await sendPaymentLinkConfirmationEmail(
      { ...fresh, items: fresh.order_items }, customer.email, customer.name,
    ).catch((e) => console.error("[SquareWebhook] confirmation email failed:", e));
  }
  console.log(`[SquareWebhook] payment confirmed for order ${order.order_number}`);
}

async function handleRefundEvent(admin: ReturnType<typeof adminClient>, event: SquareWebhookEvent): Promise<void> {
  const refund = event.data?.object?.refund;
  if (!refund?.id) return;
  const { data: row, error: refundLookupError } = await admin.from("order_refunds").select("id,status,order_id").eq("square_refund_id", refund.id).maybeSingle();
  if (refundLookupError) throw new Error(`Could not look up refund: ${refundLookupError.message}`);
  if (!row) {
    console.warn(`[SquareWebhook] no order_refunds row for square_refund_id ${refund.id}`);
    return;
  }
  if (refund.status === "COMPLETED") {
    if (row.status === "completed") return;
    await finalizeRefund(admin, row.id);
    return;
  }
  if (["FAILED", "REJECTED"].includes(refund.status || "")) {
    const message = refund.reason || `Square refund ${refund.status?.toLowerCase()}.`;
    const { error } = await admin.from("order_refunds").update({ status: "failed" }).eq("id", row.id).neq("status", "completed");
    if (error) throw new Error(`Could not record failed refund: ${error.message}`);
    await admin.from("orders").update({ refund_failed_reason: message }).eq("id", row.order_id);
  }
}
