import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createSale, rollbackCreatedSale, SaleCreationError } from "@/lib/create-sale";
import { orderNumber } from "@/lib/order-money";
import { complianceOrderValues, resolveSaleCompliance } from "@/lib/sale-compliance";
import { cancelPaymentLink, createPaymentLink } from "@/lib/square-checkout";
import { logOrderEvent } from "@/lib/order-events";
import { isSquareWalkIn, walkInOrderState } from "@/lib/walk-in-payment";

interface SaleLineInput {
  itemId: string;
  qty: number;
  soldPrice: number;
  packSize?: number;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function parseLines(value: unknown): SaleLineInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new SaleCreationError("Add between 1 and 100 products.", 400);
  }
  const seen = new Set<string>();
  return value.map((candidate) => {
    const line = candidate as Partial<SaleLineInput>;
    const itemId = typeof line.itemId === "string" ? line.itemId.trim() : "";
    const qty = Number(line.qty);
    const soldPrice = Number(line.soldPrice);
    const packSize = line.packSize == null ? undefined : Number(line.packSize);
    if (!itemId || !Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      throw new SaleCreationError("One or more sale quantities are invalid.", 400);
    }
    if (!Number.isFinite(soldPrice) || soldPrice < 0 || soldPrice > 1_000_000) {
      throw new SaleCreationError("One or more sale prices are invalid.", 400);
    }
    if (packSize != null && (!Number.isInteger(packSize) || packSize <= 0)) throw new SaleCreationError("Package size is invalid.", 400);
    const key = `${itemId}:${packSize ?? "default"}`;
    if (seen.has(key)) throw new SaleCreationError("A package appears more than once in the sale.", 400);
    seen.add(key);
    return { itemId, qty, soldPrice, packSize };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  try {
    const body = await request.json();
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
    const discountReason = typeof body.discountReason === "string" ? body.discountReason.trim() : "";
    const lines = parseLines(body.lines);

    if (!customerName || customerName.length > 200) {
      return NextResponse.json({ error: "Enter the customer's name." }, { status: 400 });
    }
    if (!customerEmail || customerEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: "Enter a valid customer email." }, { status: 400 });
    }
    const compliance = await resolveSaleCompliance(admin, body);
    const squareWalkIn = isSquareWalkIn(compliance.paymentMethod);

    const { data: customer, error: customerError } = await admin
      .from("walk_in_customers")
      .upsert({ email: customerEmail, name: customerName }, { onConflict: "email" })
      .select("id")
      .single();
    if (customerError || !customer) throw new Error("Could not save the walk-in customer.");

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const soldByName =
      (authUser.user?.user_metadata?.full_name as string | undefined)?.trim()
      || authUser.user?.email?.split("@")[0]
      || "Staff";
    const sale = await createSale({
      admin,
      source: "walk_in",
      orderNumber: orderNumber(),
      pricing: "explicit",
      taxRate: compliance.taxRate,
      discountReason,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        packSize: line.packSize,
        quantity: line.qty,
        soldPrice: line.soldPrice,
        decrementInventory: true,
      })),
      orderValues: ({ taxAmount }) => ({
        user_id: null,
        ...walkInOrderState(compliance.paymentMethod),
        notes: compliance.taxRate > 0 ? `Tax (${(compliance.taxRate * 100).toFixed(2)}%): $${taxAmount.toFixed(2)}` : "Tax exempt — approved reseller permit",
        walk_in_customer_id: customer.id,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
        ...complianceOrderValues(compliance, auth.userId),
      }),
    });

    let squarePaymentUrl: string | undefined;
    if (squareWalkIn) {
      let paymentLinkId: string | undefined;
      try {
        const link = await createPaymentLink({
          idempotencyKey: sale.order.id,
          referenceId: sale.order.order_number,
          lineItems: [
            ...sale.squarePlan.lines.map((line) => ({ name: line.name, quantity: String(line.quantity), basePriceMoneyCents: line.unitPriceCents })),
            ...(sale.squarePlan.taxCents > 0 ? [{ name: "Sales Tax", quantity: "1", basePriceMoneyCents: sale.squarePlan.taxCents }] : []),
          ],
          buyerEmail: customerEmail,
          note: `Walk-in order ${sale.order.order_number} — ${customerName}`,
        });
        paymentLinkId = link.paymentLinkId;
        const { error: linkSaveError } = await admin.from("orders").update({
          square_order_id: link.squareOrderId,
          square_payment_link_id: link.paymentLinkId,
          square_payment_link_url: link.url,
          square_payment_link_status: "active",
        }).eq("id", sale.order.id);
        if (linkSaveError) throw new Error(`The Square payment link could not be saved: ${linkSaveError.message}`);
        squarePaymentUrl = link.url;
        await logOrderEvent(admin, {
          orderId: sale.order.id, eventType: "payment_link_created", actorId: auth.userId,
          actorName: soldByName, squareRef: link.paymentLinkId, newValue: { total: sale.total, source: "walk_in" },
        });
      } catch (squareError) {
        if (paymentLinkId) {
          try { await cancelPaymentLink(paymentLinkId); } catch (cancelError) { console.error("[Walk-in] could not deactivate Square link after failure:", cancelError); }
        }
        await rollbackCreatedSale(admin, sale);
        throw new SaleCreationError(`Square checkout could not be created: ${squareError instanceof Error ? squareError.message : "Unknown error"}. No sale was recorded and stock was restored.`, 502);
      }
    }

    console.log(`[Walk-in] ${sale.order.order_number} ${squareWalkIn ? "awaiting Square payment" : "completed"} by ${auth.userId}`);
    return NextResponse.json({
      ok: true,
      orderId: sale.order.id,
      orderNumber: sale.order.order_number,
      total: sale.total,
      discountTotal: sale.discountTotal,
      taxRate: compliance.taxRate,
      taxAmount: sale.taxAmount,
      soldByName,
      squarePaymentUrl,
      awaitingPayment: squareWalkIn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete the sale.";
    console.error("[Walk-in] sale error:", message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof SaleCreationError ? error.status : 500 },
    );
  }
}
