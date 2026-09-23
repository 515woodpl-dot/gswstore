import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createSale, rollbackCreatedSale, SaleCreationError, type CreatedSale } from "@/lib/create-sale";
import { orderNumber, type OrderDiscount } from "@/lib/order-money";
import { cancelPaymentLink, createPaymentLink, isSquareEnvironmentConfigured } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { sendPaymentRequestEmail } from "@/lib/notifications";
import type { Order } from "@/types";

interface RawLineInput {
  itemId: string;
  quantity: number;
  lineDiscount?: number;
}

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
  let createdSale: CreatedSale | null = null;
  let claimedRequestKey: string | null = null;

  try {
    const body = await request.json();
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
    const customerNotes = typeof body.customerNotes === "string" ? body.customerNotes.trim() : "";
    const internalNotes = typeof body.internalNotes === "string" ? body.internalNotes.trim() : "";
    const testMode = body.testMode === true;
    const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";
    const taxZip = typeof body.taxZip === "string" ? body.taxZip.trim() : "";
    const applyTax = body.applyTax !== false;

    if (testMode && !isSquareEnvironmentConfigured("sandbox")) {
      return NextResponse.json({
        error: "Square Sandbox is not configured. Add SQUARE_SANDBOX_ACCESS_TOKEN and SQUARE_SANDBOX_LOCATION_ID before running an end-to-end test.",
      }, { status: 409 });
    }

    const discount: OrderDiscount | undefined =
      body.discount && (body.discount.type === "percent" || body.discount.type === "fixed")
        ? { type: body.discount.type, value: Number(body.discount.value) || 0 }
        : undefined;
    const discountReason = typeof body.discountReason === "string" ? body.discountReason.trim() : "";

    if (!customerName || customerName.length > 200) {
      return NextResponse.json({ error: "Enter the customer's name." }, { status: 400 });
    }
    if (!customerEmail || customerEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: "Enter a valid customer email." }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
      return NextResponse.json({ error: "The order request key is invalid. Refresh and try again." }, { status: 400 });
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 100) {
      return NextResponse.json({ error: "Add between 1 and 100 products." }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const l of body.lines) {
      if (!l?.itemId || seen.has(l.itemId)) {
        return NextResponse.json({ error: "A product appears more than once, or is missing an id." }, { status: 400 });
      }
      seen.add(l.itemId);
    }

    const rawLines = body.lines as RawLineInput[];
    let taxRate = 0;
    if (applyTax) {
      if (!/^\d{5}$/.test(taxZip)) {
        return NextResponse.json({ error: "Enter a valid 5-digit ZIP to calculate sales tax." }, { status: 400 });
      }
      const { data: rates, error: taxError } = await admin
        .from("tax_rates")
        .select("combined_rate")
        .eq("zip", taxZip);
      if (taxError || !rates?.length) {
        return NextResponse.json({ error: "No sales-tax rate was found for that ZIP." }, { status: 409 });
      }
      const frequency = new Map<string, number>();
      for (const row of rates) {
        const key = String(row.combined_rate);
        frequency.set(key, (frequency.get(key) ?? 0) + 1);
      }
      taxRate = Number([...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 0.25) {
        throw new Error("The configured sales-tax rate is invalid.");
      }
    }
    const { error: requestClaimError } = await admin.from("admin_order_requests").insert({ request_key: requestKey });
    if (requestClaimError) {
      if (requestClaimError.code !== "23505") throw new Error(`Could not start the order: ${requestClaimError.message}`);
      const { data: previous } = await admin.from("admin_order_requests").select("status,response,order_id").eq("request_key", requestKey).single();
      if (previous?.status === "completed" && previous.response) return NextResponse.json(previous.response);
      return NextResponse.json({ error: "This order request is already being processed. Check Orders before trying again.", orderId: previous?.order_id }, { status: 409 });
    }
    claimedRequestKey = requestKey;

    const { data: customer, error: customerError } = await admin
      .from("walk_in_customers")
      .upsert({ email: customerEmail, name: customerName, phone: customerPhone }, { onConflict: "email" })
      .select("id")
      .single();
    if (customerError || !customer) throw new Error("Could not save the customer.");

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const soldByName =
      (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() ||
      authUser.user?.email?.split("@")[0] ||
      "Staff";

    const num = orderNumber(testMode ? "TEST" : "GSW");
    createdSale = await createSale({
      admin,
      source: "admin_payment_link",
      orderNumber: num,
      pricing: "discounted_catalog",
      taxRate,
      orderDiscount: discount,
      discountReason,
      lines: rawLines.map((line) => ({
        itemId: String(line.itemId),
        quantity: Number(line.quantity),
        lineDiscount: Number(line.lineDiscount) || 0,
        decrementInventory: true,
      })),
      orderValues: ({ discountTotal }) => ({
        user_id: null,
        status: "awaiting_payment",
        payment_status: "unpaid",
        is_test: testMode,
        test_inventory_reserved: testMode,
        customer_name: customerName,
        customer_email: customerEmail,
        discount_type: discount?.type || "",
        discount_reason: discountReason,
        discounted_by: discountTotal > 0 ? auth.userId : null,
        discounted_at: discountTotal > 0 ? new Date().toISOString() : null,
        notes: customerNotes,
        internal_notes: internalNotes,
        attention_note: "",
        walk_in_customer_id: customer.id,
        customer_phone: customerPhone,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
      }),
    });
    const { order, items: insertedItems, squarePlan: plan, total } = createdSale;
    await admin.from("admin_order_requests").update({ order_id: order.id, updated_at: new Date().toISOString() }).eq("request_key", requestKey);

    // ── Square: create the hosted order + payment link ─────────────────────
    // Tax is sent as its own real line item (not a Square tax object) so the
    // total Square charges is byte-identical to the total we already stored.
    const squareLineItems = [
      ...plan.lines.map((l) => ({ name: l.name, quantity: String(l.quantity), basePriceMoneyCents: l.unitPriceCents })),
      ...(plan.taxCents > 0 ? [{ name: "Sales Tax", quantity: "1", basePriceMoneyCents: plan.taxCents }] : []),
    ];
    let link;
    try {
      link = await createPaymentLink({
        idempotencyKey: order.id,
        referenceId: num,
        lineItems: squareLineItems,
        buyerEmail: customerEmail,
        note: `Order ${num} — ${customerName}`,
      }, testMode ? "sandbox" : "production");
    } catch (squareErr) {
      // Order + items are saved, but no link went out — surface this clearly
      // so the admin can retry sending the link without recreating the order.
      await logOrderEvent(admin, {
        orderId: order.id,
        eventType: "payment_failed",
        actorId: auth.userId,
        actorName: soldByName,
        reason: squareErr instanceof Error ? squareErr.message : "Square error",
      });
      const { error: failedStatusError } = await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      if (failedStatusError) console.error("[PaymentLink] could not mark failed order:", failedStatusError.message);
      await admin.from("admin_order_requests").update({ status: "recoverable", order_id: order.id, updated_at: new Date().toISOString() }).eq("request_key", requestKey);
      return NextResponse.json({
        ok: false,
        orderId: order.id,
        orderNumber: num,
        error: `Order was created, but the Square payment link could not be generated: ${squareErr instanceof Error ? squareErr.message : "Unknown error"}. You can retry from the order.`,
      }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    const { error: linkSaveError } = await admin.from("orders").update({
      square_order_id: link.squareOrderId,
      square_payment_link_id: link.paymentLinkId,
      square_payment_link_url: link.url,
      square_payment_link_status: "active",
      payment_link_sent_at: nowIso,
    }).eq("id", order.id);
    if (linkSaveError) {
      try {
        await cancelPaymentLink(link.paymentLinkId, testMode ? "sandbox" : "production");
      } catch (cancelError) {
        await admin.from("admin_order_requests").update({ status: "recoverable", order_id: order.id, updated_at: nowIso }).eq("request_key", requestKey);
        console.error("[PaymentLink] CRITICAL: link was created but neither saved nor cancelled", { orderId: order.id, squareOrderId: link.squareOrderId, paymentLinkId: link.paymentLinkId, cancelError });
        return NextResponse.json({
          ok: false,
          orderId: order.id,
          orderNumber: num,
          paymentLinkUrl: link.url,
          error: "Square created the payment link, but the order could not record it or deactivate it. Do not recreate this order; reconcile it from the Square Dashboard.",
        }, { status: 502 });
      }
      throw new Error(`The payment link could not be saved: ${linkSaveError.message}`);
    }

    await logOrderEvent(admin, {
      orderId: order.id, eventType: "order_created", actorId: auth.userId, actorName: soldByName,
      newValue: { total, itemCount: insertedItems.length, testMode },
    });
    await logOrderEvent(admin, {
      orderId: order.id, eventType: "payment_link_created", actorId: auth.userId, actorName: soldByName,
      squareRef: link.paymentLinkId, newValue: { total },
    });

    // ── Email the customer their payment link ───────────────────────────────
    let emailSent = true;
    try {
      await sendPaymentRequestEmail(
        { ...order, order_number: num, notes: customerNotes, total, items: insertedItems } as unknown as Order,
        customerEmail, customerName, link.url, false,
      );
      await logOrderEvent(admin, { orderId: order.id, eventType: "payment_email_sent", actorId: auth.userId, actorName: soldByName });
    } catch (emailErr) {
      emailSent = false;
      console.error("[PaymentLink] email send failed:", emailErr instanceof Error ? emailErr.message : emailErr);
      // Link is still valid — the admin can resend from the order screen.
    }

    const response = { ok: true, orderId: order.id, orderNumber: num, total, paymentLinkUrl: link.url, emailSent, testMode };
    const { error: requestCompleteError } = await admin.from("admin_order_requests").update({
      status: "completed", order_id: order.id, response, updated_at: new Date().toISOString(),
    }).eq("request_key", requestKey);
    if (requestCompleteError) console.error("[PaymentLink] request completion record failed:", requestCompleteError.message);
    return NextResponse.json(response);
  } catch (error) {
    if (createdSale) await rollbackCreatedSale(admin, createdSale);
    if (claimedRequestKey) await admin.from("admin_order_requests").delete().eq("request_key", claimedRequestKey);
    const message = error instanceof Error ? error.message : "Could not create the order.";
    console.error("[PaymentLink/create]", message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof SaleCreationError ? error.status : 500 },
    );
  }
}
