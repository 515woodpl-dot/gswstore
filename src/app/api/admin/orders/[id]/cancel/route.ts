import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin";
import { createRefund } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { finalizeRefund, finalizeUnpaidFullCancellation } from "@/lib/refund-finalize";

const REASONS = new Set([
  "customer_requested", "items_unavailable", "inventory_issue",
  "duplicate_order", "payment_issue", "unable_to_fulfill", "other",
]);

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: orderId } = await params;
  const admin = adminClient();

  try {
    const body = await request.json();
    const reason = String(body.reason || "");
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!REASONS.has(reason)) return NextResponse.json({ error: "Choose a cancellation reason." }, { status: 400 });
    if (reason === "other" && !note) return NextResponse.json({ error: "Add a short note for \"Other\"." }, { status: 400 });

    const { data: order, error: orderErr } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
    if (orderErr || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "cancelled") return NextResponse.json({ error: "Order is already cancelled." }, { status: 409 });
    if (order.status === "completed") return NextResponse.json({ error: "Cannot cancel a completed order." }, { status: 409 });

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
    const fullReason = reason === "other" ? note : reason.replace(/_/g, " ");

    const isPaid = order.payment_status === "paid" || order.payment_status === "partially_refunded";

    if (!isPaid) {
      await finalizeUnpaidFullCancellation(admin, orderId, fullReason, auth.userId, actorName);
      return NextResponse.json({ ok: true });
    }

    const refundableCents = Math.round((Number(order.amount_paid || 0) - Number(order.amount_refunded || 0)) * 100);
    if (refundableCents <= 0) {
      // Everything was already refunded — just close out the order record.
      await admin.from("orders").update({
        status: "cancelled", cancellation_reason: fullReason, cancelled_by: auth.userId, cancelled_at: new Date().toISOString(),
      }).eq("id", orderId);
      await logOrderEvent(admin, { orderId, eventType: "order_cancelled", actorId: auth.userId, actorName, reason: fullReason });
      return NextResponse.json({ ok: true });
    }
    if (order.is_test) {
      const testRefundId = randomUUID();
      const { error: testIntentError } = await admin.from("order_refunds").insert({
        id: testRefundId,
        order_id: orderId,
        order_item_id: null,
        square_refund_id: `TEST-${testRefundId}`,
        square_payment_id: order.square_payment_id,
        amount: refundableCents / 100,
        status: "pending",
        reason: fullReason,
        created_by: auth.userId,
        meta: { kind: "full" },
      });
      if (testIntentError) return NextResponse.json({ error: "Another test refund is already in progress for this order." }, { status: 409 });
      await admin.from("orders").update({ cancellation_reason: fullReason, cancelled_by: auth.userId }).eq("id", orderId);
      await finalizeRefund(admin, testRefundId);
      return NextResponse.json({ ok: true, status: "completed", refundAmount: refundableCents / 100, testMode: true });
    }
    if (!order.square_payment_id) {
      return NextResponse.json({ error: "No Square payment is on file for this order." }, { status: 409 });
    }

    // Record intent immediately (audit only) — order.status stays as-is until
    // Square actually confirms the refund.
    await admin.from("orders").update({ cancellation_reason: fullReason, cancelled_by: auth.userId }).eq("id", orderId);

    const refundIntentId = randomUUID();
    const { error: intentError } = await admin.from("order_refunds").insert({
      id: refundIntentId,
      order_id: orderId,
      order_item_id: null,
      square_payment_id: order.square_payment_id,
      amount: refundableCents / 100,
      status: "creating",
      reason: fullReason,
      created_by: auth.userId,
      meta: { kind: "full" },
    });
    if (intentError) return NextResponse.json({ error: "Another refund is already in progress for this order." }, { status: 409 });

    let refund;
    try {
      refund = await createRefund({
        idempotencyKey: refundIntentId,
        paymentId: order.square_payment_id,
        amountCents: refundableCents,
        reason: `Order ${order.order_number} cancelled: ${fullReason}`,
      });
    } catch (e) {
      await admin.from("order_refunds").update({ status: "failed" }).eq("id", refundIntentId);
      await logOrderEvent(admin, { orderId, eventType: "full_refund_failed", actorId: auth.userId, actorName, reason: e instanceof Error ? e.message : "Square error" });
      await admin.from("orders").update({ refund_failed_reason: e instanceof Error ? e.message : "Square refund failed" }).eq("id", orderId);
      return NextResponse.json({ error: `Square could not process the refund: ${e instanceof Error ? e.message : "Unknown error"}. The order has not been cancelled — you can retry.` }, { status: 502 });
    }

    if (["FAILED", "REJECTED"].includes(refund.status)) {
      await admin.from("order_refunds").update({ status: "failed" }).eq("id", refundIntentId);
      return NextResponse.json({ error: `Square rejected the refund (${refund.status.toLowerCase()}). The order has not been cancelled.` }, { status: 502 });
    }

    const { data: refundRow, error: refundUpdateError } = await admin.from("order_refunds").update({
      square_refund_id: refund.refundId,
      status: "pending",
    }).eq("id", refundIntentId).select("id").single();
    if (refundUpdateError || !refundRow) throw new Error("Square accepted the refund, but its local record could not be updated.");

    await logOrderEvent(admin, {
      orderId, eventType: "full_refund_requested", actorId: auth.userId, actorName, reason: fullReason,
      squareRef: refund.refundId, newValue: { amount: refundableCents / 100 },
    });

    if (refund.status === "COMPLETED" && refundRow) {
      await finalizeRefund(admin, refundRow.id);
    }

    return NextResponse.json({ ok: true, status: refund.status === "COMPLETED" ? "completed" : "pending", refundAmount: refundableCents / 100 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel this order.";
    console.error("[CancelOrder]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
