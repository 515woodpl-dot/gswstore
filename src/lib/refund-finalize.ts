// ── Idempotent refund finalization ───────────────────────────────────────────
// A refund is only *requested* synchronously (Square accepted it). All of its
// side effects — item/order state, inventory restock, payment_status, and the
// customer email — are applied here, exactly once, gated on Square confirming
// COMPLETED. This function is safe to call from both the synchronous refund
// route (when Square's own response already says COMPLETED) and the
// /api/webhooks/square handler (when confirmation arrives async); whichever
// gets there first wins through the transactional finalize_order_refund RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import { logOrderEvent } from "@/lib/order-events";
import { sendRefundEmail, sendCancellationEmail } from "@/lib/notifications";
import { cancelPaymentLink } from "@/lib/square-checkout";
import type { CustomerRow } from "@/lib/admin-order-types";

interface PartialLine { orderItemId: string; cancelQty: number; itemName?: string }
export type RefundMeta = { kind: "full" } | { kind: "partial"; lines: PartialLine[] };

export async function finalizeRefund(admin: SupabaseClient, refundRowId: string): Promise<void> {
  const { data: result, error: finalizeError } = await admin.rpc("finalize_order_refund", { p_refund_id: refundRowId });
  if (finalizeError) throw new Error(`Refund finalization failed: ${finalizeError.message}`);
  const outcome = result as { applied?: boolean } | null;
  if (!outcome?.applied) return;

  const { data: claimed, error: refundError } = await admin.from("order_refunds").select("*").eq("id", refundRowId).single();
  if (refundError || !claimed) throw new Error("Finalized refund could not be reloaded.");
  const { data: order, error: orderError } = await admin.from("orders").select("*, order_items(*)").eq("id", claimed.order_id).single();
  if (orderError || !order) throw new Error(`Order ${claimed.order_id} could not be reloaded after refund.`);

  const { data: customer }: { data: CustomerRow | null } = order.walk_in_customer_id
    ? await admin.from("walk_in_customers").select("name,email").eq("id", order.walk_in_customer_id).single()
    : { data: null };
  const customerEmail: string = customer?.email || order.customer_email || "";
  const customerName: string = customer?.name || order.customer_name || "";

  const meta = claimed.meta as RefundMeta;
  const amount = Number(claimed.amount);

  if (meta.kind === "full") {
    await logOrderEvent(admin, {
      orderId: order.id, eventType: "full_refund_completed", squareRef: claimed.square_refund_id,
      reason: claimed.reason, newValue: { amount },
    });

    if (customerEmail) {
      await sendRefundEmail(order, customerEmail, customerName, {
        refundAmount: amount, remainingTotal: 0, full: true, receiptUrl: order.square_receipt_url,
      }).catch((e) => console.error("[Refund] email failed:", e));
    }
    console.log(`[Refund] full refund finalized for order ${order.order_number}`);
    return;
  }

  await logOrderEvent(admin, {
    orderId: order.id, eventType: "partial_refund_completed", squareRef: claimed.square_refund_id,
    reason: claimed.reason, newValue: { amount, newTotal: Number(order.total) },
  });

  if (customerEmail && amount > 0) {
    await sendRefundEmail(order, customerEmail, customerName, {
      refundedItemName: meta.lines.map((line) => line.itemName).filter(Boolean).join(", "),
      refundAmount: amount, remainingTotal: Number(order.total), full: false, receiptUrl: order.square_receipt_url,
    }).catch((e) => console.error("[Refund] email failed:", e));
  }
  console.log(`[Refund] partial refund finalized for order ${order.order_number}: -${amount}`);
}

/** Section 10 — full cancellation with NO payment ever taken. Fully synchronous, no Square refund involved. */
export async function finalizeUnpaidFullCancellation(
  admin: SupabaseClient,
  orderId: string,
  reason: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: order } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
  if (!order) return;

  // The external link must be inactive before local inventory is released.
  if (order.square_payment_link_id && order.square_payment_link_status === "active") {
    await cancelPaymentLink(order.square_payment_link_id);
  }

  const { error: cancelError } = await admin.rpc("cancel_unpaid_order", {
    p_order_id: orderId,
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (cancelError) throw new Error(`Could not cancel the order: ${cancelError.message}`);

  await logOrderEvent(admin, { orderId, eventType: "order_cancelled", actorId, actorName, reason });

  const { data: customer }: { data: CustomerRow | null } = order.walk_in_customer_id
    ? await admin.from("walk_in_customers").select("name,email").eq("id", order.walk_in_customer_id).single()
    : { data: null };
  if (customer?.email) {
    await sendCancellationEmail(order, customer.email, customer.name, reason).catch((e: unknown) => console.error("[Cancel] email failed:", e));
  }
}
