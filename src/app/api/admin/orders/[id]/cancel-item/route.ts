import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin";
import { createPaymentLink, createRefund, cancelPaymentLink } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { sendPaymentRequestEmail } from "@/lib/notifications";
import { finalizeRefund, finalizeUnpaidFullCancellation } from "@/lib/refund-finalize";
import type { AdminOrderItemRow, CustomerRow } from "@/lib/admin-order-types";

const REASONS = new Set([
  "out_of_stock", "item_unavailable", "damaged", "inventory_error",
  "customer_requested", "duplicate_item", "incorrect_item", "other",
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
    const orderItemId = String(body.orderItemId || "");
    const cancelQty = Number(body.cancelQty);
    const reason = String(body.reason || "");
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!orderItemId || !Number.isInteger(cancelQty) || cancelQty <= 0) {
      return NextResponse.json({ error: "Invalid item or quantity." }, { status: 400 });
    }
    if (!REASONS.has(reason)) return NextResponse.json({ error: "Choose a cancellation reason." }, { status: 400 });
    if (reason === "other" && !note) return NextResponse.json({ error: "Add a short note for \"Other\"." }, { status: 400 });

    const { data: order, error: orderErr } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
    if (orderErr || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "cancelled" || order.status === "completed") {
      return NextResponse.json({ error: `Cannot modify a ${order.status} order.` }, { status: 409 });
    }

    const item = (order.order_items as AdminOrderItemRow[]).find((i) => i.id === orderItemId);
    if (!item) return NextResponse.json({ error: "Item not found on this order." }, { status: 404 });
    const remainingQty = Number(item.quantity) - Number(item.cancelled_quantity || 0);
    if (cancelQty > remainingQty) {
      return NextResponse.json({ error: `Only ${remainingQty} of this item remain on the order.` }, { status: 409 });
    }

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";

    const isPaid = order.payment_status === "paid" || order.payment_status === "partially_refunded";

    // ── Case 1: order unpaid — cancel now, reissue payment link ─────────────
    if (!isPaid) {
      // Never change the local amount while an old checkout link can still be
      // paid. A non-404 Square failure throws and leaves the order untouched.
      if (order.square_payment_link_id && order.square_payment_link_status === "active") {
        await cancelPaymentLink(order.square_payment_link_id);
      }

      const { data: cancelledQuantity, error: cancelError } = await admin.rpc("cancel_unpaid_order_item", {
        p_order_id: orderId,
        p_order_item_id: item.id,
        p_cancel_qty: cancelQty,
        p_reason: reason,
        p_note: note,
        p_actor_id: auth.userId,
      });
      if (cancelError) throw new Error(`Could not cancel ${item.name}: ${cancelError.message}`);
      const newCancelledQty = Number(cancelledQuantity);

      await logOrderEvent(admin, {
        orderId, eventType: cancelQty >= item.quantity ? "item_cancelled" : "quantity_partially_cancelled",
        actorId: auth.userId, actorName, reason, previousValue: { quantity: remainingQty }, newValue: { cancelledQty: cancelQty },
      });

      const { data: freshItems } = await admin.from("order_items").select("*").eq("order_id", orderId);
      const activeLines = (freshItems ?? []).filter(
        (i: AdminOrderItemRow) => Number(i.quantity) - Number(i.cancelled_quantity) > 0,
      );

      if (activeLines.length === 0) {
        await finalizeUnpaidFullCancellation(admin, orderId, "All items unavailable", auth.userId, actorName);
        return NextResponse.json({ ok: true, orderCancelled: true });
      }

      // Recompute totals from what remains, net-of-discount unit prices are
      // already final per line (see /payment-link/create), so the new order
      // total is simply the sum over the still-active quantities.
      const netSubtotalCents = activeLines.reduce(
        (s: number, i: AdminOrderItemRow) => s + Math.round(Number(i.net_amount ?? i.unit_price * i.quantity) * 100 * (Number(i.quantity) - Number(i.cancelled_quantity)) / Number(i.quantity)), 0,
      );
      const taxCents = activeLines.reduce(
        (s: number, i: AdminOrderItemRow) => s + Math.round(Number(i.tax_amount || 0) * 100 * (Number(i.quantity) - Number(i.cancelled_quantity)) / Number(i.quantity)), 0,
      );
      const newTotalCents = netSubtotalCents + taxCents;

      if (order.is_test) {
        return NextResponse.json({ ok: true, newTotal: newTotalCents / 100, testMode: true });
      }

      // Record that the old link is gone before issuing its replacement.
      if (order.square_payment_link_id && order.square_payment_link_status === "active") {
        const { error: replaceError } = await admin.from("orders").update({ square_payment_link_status: "replaced" }).eq("id", orderId);
        if (replaceError) throw new Error(`Could not record the replaced payment link: ${replaceError.message}`);
        await logOrderEvent(admin, { orderId, eventType: "payment_link_replaced", actorId: auth.userId, actorName, squareRef: order.square_payment_link_id });
      }
      const squareLineItems = activeLines.flatMap((i: AdminOrderItemRow) => {
        const quantity = Number(i.quantity) - Number(i.cancelled_quantity);
        const cents = Math.round(Number(i.net_amount ?? i.unit_price * i.quantity) * 100 * quantity / Number(i.quantity));
        const low = Math.floor(cents / quantity);
        const highCount = cents - low * quantity;
        return [
          ...(highCount ? [{ name: i.name, quantity: String(highCount), basePriceMoneyCents: low + 1 }] : []),
          ...(quantity - highCount ? [{ name: i.name, quantity: String(quantity - highCount), basePriceMoneyCents: low }] : []),
        ];
      });
      if (taxCents > 0) squareLineItems.push({ name: "Sales Tax", quantity: "1", basePriceMoneyCents: taxCents });
      const link = await createPaymentLink({
        idempotencyKey: createHash("sha256").update(`${orderId}:${item.id}:${newCancelledQty}`).digest("hex").slice(0, 45),
        referenceId: order.order_number,
        lineItems: squareLineItems,
        buyerEmail: undefined,
        note: `Order ${order.order_number} (updated)`,
      });

      const { error: linkUpdateError } = await admin.from("orders").update({
        square_order_id: link.squareOrderId,
        square_payment_link_id: link.paymentLinkId,
        square_payment_link_url: link.url,
        square_payment_link_status: "active",
        payment_link_sent_at: new Date().toISOString(),
      }).eq("id", orderId);
      if (linkUpdateError) throw new Error(`The replacement link was created, but could not be saved: ${linkUpdateError.message}`);

      await logOrderEvent(admin, { orderId, eventType: "payment_link_created", actorId: auth.userId, actorName, squareRef: link.paymentLinkId, newValue: { total: newTotalCents / 100 } });

      const { data: customer }: { data: CustomerRow | null } = order.walk_in_customer_id
        ? await admin.from("walk_in_customers").select("name,email").eq("id", order.walk_in_customer_id).single()
        : { data: null };
      if (customer?.email) {
        const { data: refreshedOrder } = await admin.from("orders").select("*, order_items(*)").eq("id", orderId).single();
        await sendPaymentRequestEmail(
          { ...refreshedOrder, items: refreshedOrder.order_items },
          customer.email, customer.name, link.url, true,
        ).catch((e) => console.error("[CancelItem] update email failed:", e));
      }

      return NextResponse.json({ ok: true, newTotal: newTotalCents / 100, paymentLinkUrl: link.url });
    }

    // ── Case 2: order already paid — issue a Square refund, deferred finalize ─
    const oldCancelledQty = Number(item.cancelled_quantity || 0);
    const newCancelledQty = oldCancelledQty + cancelQty;
    const originalNetCents = Math.round(Number(item.net_amount ?? item.unit_price * item.quantity) * 100);
    const originalTaxCents = Math.round(Number(item.tax_amount || 0) * 100);
    const itemAmountCents = Math.round(originalNetCents * newCancelledQty / item.quantity) - Math.round(originalNetCents * oldCancelledQty / item.quantity);
    const taxAmountCents = Math.round(originalTaxCents * newCancelledQty / item.quantity) - Math.round(originalTaxCents * oldCancelledQty / item.quantity);
    const totalRefundCents = itemAmountCents + taxAmountCents;

    // A fully discounted item still needs an atomic inventory/order update,
    // but Square correctly rejects a zero-dollar refund request.
    if (totalRefundCents === 0) {
      const localIntentId = randomUUID();
      const { error: localIntentError } = await admin.from("order_refunds").insert({
        id: localIntentId,
        order_id: orderId,
        order_item_id: item.id,
        square_payment_id: order.square_payment_id,
        amount: 0,
        status: "pending",
        reason: `${item.name} × ${cancelQty}: ${reason}${note ? ` — ${note}` : ""}`,
        created_by: auth.userId,
        meta: { kind: "partial", lines: [{ orderItemId: item.id, cancelQty, itemName: item.name }] },
      });
      if (localIntentError) return NextResponse.json({ error: "Another refund or cancellation is already in progress for this order." }, { status: 409 });
      const { error: reasonError } = await admin.from("order_items").update({ cancellation_reason: reason, cancellation_note: note }).eq("id", item.id);
      if (reasonError) throw new Error(`Could not save the cancellation reason: ${reasonError.message}`);
      await finalizeRefund(admin, localIntentId);
      return NextResponse.json({ ok: true, refundAmount: 0, status: "completed" });
    }

    const refundableCents = Math.round((Number(order.amount_paid || 0) - Number(order.amount_refunded || 0)) * 100);
    if (totalRefundCents > refundableCents) {
      return NextResponse.json({ error: "This refund would exceed the amount still available to refund on this order." }, { status: 409 });
    }
    if (order.is_test) {
      const testRefundId = randomUUID();
      const { error: testIntentError } = await admin.from("order_refunds").insert({
        id: testRefundId,
        order_id: orderId,
        order_item_id: item.id,
        square_refund_id: `TEST-${testRefundId}`,
        square_payment_id: order.square_payment_id,
        amount: totalRefundCents / 100,
        status: "pending",
        reason: `${item.name} × ${cancelQty}: ${reason}${note ? ` — ${note}` : ""}`,
        created_by: auth.userId,
        meta: { kind: "partial", lines: [{ orderItemId: item.id, cancelQty, itemName: item.name }] },
      });
      if (testIntentError) return NextResponse.json({ error: "Another test refund is already in progress for this order." }, { status: 409 });
      const { error: reasonError } = await admin.from("order_items").update({ cancellation_reason: reason, cancellation_note: note }).eq("id", item.id);
      if (reasonError) throw new Error(`Could not save the cancellation reason: ${reasonError.message}`);
      await finalizeRefund(admin, testRefundId);
      return NextResponse.json({ ok: true, refundAmount: totalRefundCents / 100, status: "completed", testMode: true });
    }
    if (!order.square_payment_id) {
      return NextResponse.json({ error: "No Square payment is on file for this order." }, { status: 409 });
    }

    const refundIntentId = randomUUID();
    const { error: intentError } = await admin.from("order_refunds").insert({
      id: refundIntentId,
      order_id: orderId,
      order_item_id: item.id,
      square_payment_id: order.square_payment_id,
      amount: totalRefundCents / 100,
      status: "creating",
      reason: `${item.name} × ${cancelQty}: ${reason}${note ? ` — ${note}` : ""}`,
      created_by: auth.userId,
      meta: { kind: "partial", lines: [{ orderItemId: item.id, cancelQty, itemName: item.name }] },
    });
    if (intentError) return NextResponse.json({ error: "Another refund is already in progress for this order." }, { status: 409 });

    let refund;
    try {
      refund = await createRefund({
        idempotencyKey: refundIntentId,
        paymentId: order.square_payment_id,
        amountCents: totalRefundCents,
        reason: `Order ${order.order_number}: ${item.name} × ${cancelQty} (${reason})`,
      });
    } catch (e) {
      await admin.from("order_refunds").update({ status: "failed" }).eq("id", refundIntentId);
      await logOrderEvent(admin, { orderId, eventType: "partial_refund_failed", actorId: auth.userId, actorName, reason: e instanceof Error ? e.message : "Square error" });
      await admin.from("orders").update({ refund_failed_reason: e instanceof Error ? e.message : "Square refund failed" }).eq("id", orderId);
      return NextResponse.json({ error: `Square could not process the refund: ${e instanceof Error ? e.message : "Unknown error"}` }, { status: 502 });
    }

    if (["FAILED", "REJECTED"].includes(refund.status)) {
      await admin.from("order_refunds").update({ status: "failed" }).eq("id", refundIntentId);
      return NextResponse.json({ error: `Square rejected the refund (${refund.status.toLowerCase()}).` }, { status: 502 });
    }

    // Record what to apply once the refund is confirmed COMPLETED.
    await admin.from("order_items").update({ cancellation_reason: reason, cancellation_note: note }).eq("id", item.id);
    const { data: refundRow, error: refundUpdateError } = await admin.from("order_refunds").update({
      square_refund_id: refund.refundId,
      status: "pending",
    }).eq("id", refundIntentId).select("id").single();
    if (refundUpdateError || !refundRow) throw new Error("Square accepted the refund, but its local record could not be updated.");

    await logOrderEvent(admin, {
      orderId, eventType: "partial_refund_requested", actorId: auth.userId, actorName, reason,
      squareRef: refund.refundId, newValue: { amount: totalRefundCents / 100 },
    });

    if (refund.status === "COMPLETED" && refundRow) {
      await finalizeRefund(admin, refundRow.id);
    }

    return NextResponse.json({
      ok: true,
      refundAmount: totalRefundCents / 100,
      status: refund.status === "COMPLETED" ? "completed" : "pending",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel this item.";
    console.error("[CancelItem]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
