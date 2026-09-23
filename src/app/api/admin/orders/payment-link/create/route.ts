import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { computeOrder, toSquareLinePlan, orderNumber, type DraftLine, type OrderDiscount } from "@/lib/order-money";
import { cancelPaymentLink, createPaymentLink } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { sendPaymentRequestEmail } from "@/lib/notifications";

interface RawLineInput {
  itemId: string;
  quantity: number;
  lineDiscount?: number;
}

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  amount: number;
  store_price: number;
  sale_price: number | null;
  cost_price: number | null;
  units_per_sale: number | null;
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
  let createdOrderId: string | null = null;
  let claimedRequestKey: string | null = null;
  const inventoryChanges: { id: string; before: number; after: number }[] = [];

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
    const itemIds = rawLines.map((l) => String(l.itemId));
    const { data: inventoryData, error: inventoryError } = await admin
      .from("inventory")
      .select("id,name,sku,image_url,amount,store_price,sale_price,cost_price,units_per_sale")
      .in("id", itemIds);
    if (inventoryError) throw new Error("Could not verify inventory.");

    const inventoryById = new Map(((inventoryData ?? []) as InventoryRow[]).map((i) => [i.id, i]));
    if (inventoryById.size !== itemIds.length) {
      return NextResponse.json({ error: "One or more products are no longer available." }, { status: 409 });
    }

    // Verify stock and build the DraftLine[] the money module expects.
    const draftLines: DraftLine[] = rawLines.map((l) => {
      const item = inventoryById.get(String(l.itemId))!;
      const qty = Number(l.quantity);
      const unitsPerSale = Math.max(1, Number(item.units_per_sale) || 1);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid quantity for ${item.name}.`);
      if (!testMode && Number(item.amount) < qty * unitsPerSale) {
        throw new Error(`${item.name} does not have enough stock (only ${Math.floor(Number(item.amount) / unitsPerSale)} available).`);
      }
      return {
        itemId: item.id,
        quantity: qty,
        listPrice: Number(item.sale_price ?? item.store_price),
        lineDiscount: Number(l.lineDiscount) || 0,
      };
    });

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
    const computed = computeOrder(draftLines, discount, taxRate);

    if (computed.discountTotalCents > 0 && !discountReason) {
      return NextResponse.json({ error: "A discount was applied — please enter a reason." }, { status: 400 });
    }

    const names = Object.fromEntries(itemIds.map((id: string) => [id, inventoryById.get(id)!.name]));
    const plan = toSquareLinePlan(computed, names);

    const { error: requestClaimError } = await admin.from("admin_order_requests").insert({ request_key: requestKey });
    if (requestClaimError) {
      if (requestClaimError.code !== "23505") throw new Error(`Could not start the order: ${requestClaimError.message}`);
      const { data: previous } = await admin.from("admin_order_requests").select("status,response,order_id").eq("request_key", requestKey).single();
      if (previous?.status === "completed" && previous.response) return NextResponse.json(previous.response);
      return NextResponse.json({ error: "This order request is already being processed. Check Orders before trying again.", orderId: previous?.order_id }, { status: 409 });
    }
    claimedRequestKey = requestKey;

    // ── Reserve inventory now (mirrors walk-in-sale: decrement = reservation) ──
    for (const line of testMode ? [] : computed.lines) {
      const item = inventoryById.get(line.itemId)!;
      const unitsPerSale = Math.max(1, Number(item.units_per_sale) || 1);
      const baseQty = line.quantity * unitsPerSale;
      const before = Number(item.amount);
      const after = before - baseQty;
      const { data: updated, error: updateError } = await admin
        .from("inventory")
        .update({ amount: after })
        .eq("id", item.id)
        .eq("amount", before)
        .select("id")
        .maybeSingle();
      if (updateError || !updated) {
        throw new Error(`${item.name} changed while the order was being created. Please try again.`);
      }
      inventoryChanges.push({ id: item.id, before, after });
    }

    let customer: { id: string } | null = null;
    if (!testMode) {
      const { data, error: customerError } = await admin
        .from("walk_in_customers")
        .upsert({ email: customerEmail, name: customerName, phone: customerPhone }, { onConflict: "email" })
        .select("id")
        .single();
      if (customerError || !data) throw new Error("Could not save the customer.");
      customer = data;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const soldByName =
      (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() ||
      authUser.user?.email?.split("@")[0] ||
      "Staff";

    const num = orderNumber(testMode ? "TEST" : "GSW");
    const total = plan.totalCents / 100;

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: num,
        user_id: null,
        status: "awaiting_payment",
        payment_status: "unpaid",
        is_test: testMode,
        customer_name: customerName,
        customer_email: customerEmail,
        total,
        subtotal: computed.subtotalCents / 100,
        discount_total: computed.discountTotalCents / 100,
        discount_type: discount?.type || "",
        discount_reason: discountReason,
        discounted_by: computed.discountTotalCents > 0 ? auth.userId : null,
        discounted_at: computed.discountTotalCents > 0 ? new Date().toISOString() : null,
        tax_rate: taxRate,
        tax_total: plan.taxCents / 100,
        notes: customerNotes,
        internal_notes: internalNotes,
        attention_note: "",
        source: "admin_payment_link",
        walk_in_customer_id: customer?.id ?? null,
        customer_phone: customerPhone,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
      })
      .select("*")
      .single();
    if (orderError || !order) throw new Error(orderError?.message || "Could not create the order.");
    createdOrderId = order.id;
    await admin.from("admin_order_requests").update({ order_id: order.id, updated_at: new Date().toISOString() }).eq("request_key", requestKey);

    const netByItem = new Map<string, number>();
    for (const line of plan.lines) {
      netByItem.set(line.itemId, (netByItem.get(line.itemId) ?? 0) + line.lineTotalCents);
    }
    const taxShares = computed.lines.map((line) => ((netByItem.get(line.itemId) ?? 0) * plan.taxCents) / Math.max(1, computed.taxableCents));
    const taxFloors = taxShares.map(Math.floor);
    const taxRemainder = plan.taxCents - taxFloors.reduce((sum, cents) => sum + cents, 0);
    const taxOrder = taxShares
      .map((share, index) => ({ index, fraction: share - taxFloors[index] }))
      .sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < taxRemainder; i++) taxFloors[taxOrder[i % taxOrder.length].index] += 1;

    const itemRows = computed.lines.map((line, index) => {
      const item = inventoryById.get(line.itemId)!;
      const netCents = netByItem.get(line.itemId) ?? 0;
      return {
        order_id: order.id,
        item_id: item.id,
        name: item.name,
        sku: item.sku,
        image_url: item.image_url,
        unit_price: Math.round(netCents / line.quantity) / 100,
        net_amount: netCents / 100,
        list_price: line.listPrice,
        cost_price: Number(item.cost_price) || 0,
        discount_amount: (Math.round(line.listPrice * 100) * line.quantity - netCents) / 100,
        discount_reason: Math.round(line.listPrice * 100) * line.quantity > netCents ? discountReason : "",
        tax_amount: taxFloors[index] / 100,
        quantity: line.quantity,
        base_units_per_sale: Math.max(1, Number(item.units_per_sale) || 1),
        status: "active",
      };
    });
    const { data: insertedItems, error: itemsError } = await admin.from("order_items").insert(itemRows).select("*");
    if (itemsError) throw new Error("Could not save the order items.");

    if (testMode) {
      await logOrderEvent(admin, {
        orderId: order.id, eventType: "order_created", actorId: auth.userId, actorName: soldByName,
        newValue: { total, itemCount: itemRows.length, testMode: true },
      });
      const response = { ok: true, orderId: order.id, orderNumber: num, total, paymentLinkUrl: "", emailSent: false, testMode: true };
      const { error: requestCompleteError } = await admin.from("admin_order_requests").update({
        status: "completed", order_id: order.id, response, updated_at: new Date().toISOString(),
      }).eq("request_key", requestKey);
      if (requestCompleteError) console.error("[PaymentLink] test request completion record failed:", requestCompleteError.message);
      return NextResponse.json(response);
    }

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
      });
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
        await cancelPaymentLink(link.paymentLinkId);
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
      newValue: { total, itemCount: itemRows.length },
    });
    await logOrderEvent(admin, {
      orderId: order.id, eventType: "payment_link_created", actorId: auth.userId, actorName: soldByName,
      squareRef: link.paymentLinkId, newValue: { total },
    });

    // ── Email the customer their payment link ───────────────────────────────
    let emailSent = true;
    try {
      await sendPaymentRequestEmail(
        { ...order, order_number: num, notes: customerNotes, total, items: insertedItems ?? [] },
        customerEmail, customerName, link.url, false,
      );
      await logOrderEvent(admin, { orderId: order.id, eventType: "payment_email_sent", actorId: auth.userId, actorName: soldByName });
    } catch (emailErr) {
      emailSent = false;
      console.error("[PaymentLink] email send failed:", emailErr instanceof Error ? emailErr.message : emailErr);
      // Link is still valid — the admin can resend from the order screen.
    }

    const response = { ok: true, orderId: order.id, orderNumber: num, total, paymentLinkUrl: link.url, emailSent };
    const { error: requestCompleteError } = await admin.from("admin_order_requests").update({
      status: "completed", order_id: order.id, response, updated_at: new Date().toISOString(),
    }).eq("request_key", requestKey);
    if (requestCompleteError) console.error("[PaymentLink] request completion record failed:", requestCompleteError.message);
    return NextResponse.json(response);
  } catch (error) {
    // Roll back inventory + the order if anything failed after reservation.
    for (const change of inventoryChanges.reverse()) {
      await admin.from("inventory").update({ amount: change.before }).eq("id", change.id).eq("amount", change.after);
    }
    if (createdOrderId) {
      await admin.from("order_items").delete().eq("order_id", createdOrderId);
      await admin.from("orders").delete().eq("id", createdOrderId);
    }
    if (claimedRequestKey) await admin.from("admin_order_requests").delete().eq("request_key", claimedRequestKey);
    const message = error instanceof Error ? error.message : "Could not create the order.";
    console.error("[PaymentLink/create]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
