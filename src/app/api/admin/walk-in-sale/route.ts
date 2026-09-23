import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createSale, SaleCreationError } from "@/lib/create-sale";
import { orderNumber } from "@/lib/order-money";

interface SaleLineInput {
  itemId: string;
  qty: number;
  soldPrice: number;
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
    if (!itemId || !Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      throw new SaleCreationError("One or more sale quantities are invalid.", 400);
    }
    if (!Number.isFinite(soldPrice) || soldPrice < 0 || soldPrice > 1_000_000) {
      throw new SaleCreationError("One or more sale prices are invalid.", 400);
    }
    if (seen.has(itemId)) throw new SaleCreationError("A product appears more than once in the sale.", 400);
    seen.add(itemId);
    return { itemId, qty, soldPrice };
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
    const requestedTaxRate = Number(body.taxRate);
    const applyTax = body.applyTax !== false;
    const lines = parseLines(body.lines);

    if (!customerName || customerName.length > 200) {
      return NextResponse.json({ error: "Enter the customer's name." }, { status: 400 });
    }
    if (!customerEmail || customerEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: "Enter a valid customer email." }, { status: 400 });
    }
    if (!Number.isFinite(requestedTaxRate) || requestedTaxRate < 0 || requestedTaxRate > 0.2) {
      return NextResponse.json({ error: "The sales-tax rate is invalid." }, { status: 400 });
    }

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
    const taxRate = applyTax ? requestedTaxRate : 0;
    const sale = await createSale({
      admin,
      source: "walk_in",
      orderNumber: orderNumber(),
      pricing: "explicit",
      taxRate,
      discountReason,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.qty,
        soldPrice: line.soldPrice,
        decrementInventory: true,
      })),
      orderValues: ({ taxAmount }) => ({
        user_id: null,
        status: "completed",
        notes: taxRate > 0 ? `Tax (${(taxRate * 100).toFixed(2)}%): $${taxAmount.toFixed(2)}` : "",
        walk_in_customer_id: customer.id,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
      }),
    });

    console.log(`[Walk-in] ${sale.order.order_number} completed by ${auth.userId}`);
    return NextResponse.json({
      ok: true,
      orderId: sale.order.id,
      orderNumber: sale.order.order_number,
      total: sale.total,
      discountTotal: sale.discountTotal,
      taxRate,
      taxAmount: sale.taxAmount,
      soldByName,
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
