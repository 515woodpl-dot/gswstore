import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

interface SaleLineInput {
  itemId: string;
  qty: number;
  soldPrice: number;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `GSW-${date}-${suffix}`;
}

function parseLines(value: unknown): SaleLineInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("Add between 1 and 100 products.");
  }

  const seen = new Set<string>();
  return value.map((candidate) => {
    const line = candidate as Partial<SaleLineInput>;
    const itemId = typeof line.itemId === "string" ? line.itemId.trim() : "";
    const qty = Number(line.qty);
    const soldPrice = Number(line.soldPrice);
    if (!itemId || !Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      throw new Error("One or more sale quantities are invalid.");
    }
    if (!Number.isFinite(soldPrice) || soldPrice < 0 || soldPrice > 1_000_000) {
      throw new Error("One or more sale prices are invalid.");
    }
    if (seen.has(itemId)) throw new Error("A product appears more than once in the sale.");
    seen.add(itemId);
    return { itemId, qty, soldPrice: roundMoney(soldPrice) };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  let createdOrderId: string | null = null;
  const inventoryChanges: { id: string; before: number; after: number }[] = [];

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

    const itemIds = lines.map((line) => line.itemId);
    const { data: inventoryData, error: inventoryError } = await admin
      .from("inventory")
      .select("id,name,sku,image_url,amount,store_price,sale_price,cost_price,units_per_sale")
      .in("id", itemIds);
    if (inventoryError) throw new Error("Could not verify inventory.");

    const inventoryById = new Map(
      ((inventoryData ?? []) as InventoryRow[]).map((item) => [item.id, item]),
    );
    if (inventoryById.size !== itemIds.length) {
      return NextResponse.json({ error: "One or more products are no longer available." }, { status: 409 });
    }

    let subtotal = 0;
    let discountTotal = 0;
    const verifiedLines = lines.map((line) => {
      const item = inventoryById.get(line.itemId)!;
      const unitsPerSale = Math.max(1, Number(item.units_per_sale) || 1);
      const baseUnits = line.qty * unitsPerSale;
      if (Number(item.amount) < baseUnits) {
        throw new Error(`${item.name} does not have enough stock for this sale.`);
      }
      const listPrice = Number(item.sale_price ?? item.store_price);
      subtotal += line.soldPrice * line.qty;
      discountTotal += Math.max(0, (listPrice - line.soldPrice) * line.qty);
      return { ...line, item, listPrice, baseUnits, unitsPerSale };
    });

    subtotal = roundMoney(subtotal);
    discountTotal = roundMoney(discountTotal);
    if (discountTotal > 0 && !discountReason) {
      return NextResponse.json({ error: "A discount was applied — please enter a reason." }, { status: 400 });
    }

    const taxRate = applyTax ? requestedTaxRate : 0;
    const taxAmount = roundMoney(subtotal * taxRate);
    const total = roundMoney(subtotal + taxAmount);

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

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber(),
        user_id: null,
        status: "completed",
        total,
        notes: taxRate > 0 ? `Tax (${(taxRate * 100).toFixed(2)}%): $${taxAmount.toFixed(2)}` : "",
        source: "walk_in",
        walk_in_customer_id: customer.id,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
        discount_total: discountTotal,
      })
      .select("id,order_number")
      .single();
    if (orderError || !order) throw new Error("Could not create the walk-in order.");
    createdOrderId = order.id;

    const { error: orderItemsError } = await admin.from("order_items").insert(
      verifiedLines.map((line) => ({
        order_id: order.id,
        item_id: line.item.id,
        name: line.item.name,
        sku: line.item.sku,
        image_url: line.item.image_url,
        unit_price: line.soldPrice,
        list_price: line.listPrice,
        cost_price: Number(line.item.cost_price) || 0,
        discount_amount: roundMoney(Math.max(0, (line.listPrice - line.soldPrice) * line.qty)),
        discount_reason: line.listPrice > line.soldPrice ? discountReason : "",
        quantity: line.qty,
        base_units_per_sale: line.unitsPerSale,
      })),
    );
    if (orderItemsError) throw new Error("Could not save the sale items.");

    for (const line of verifiedLines) {
      const before = Number(line.item.amount);
      const after = before - line.baseUnits;
      const { data: updated, error: updateError } = await admin
        .from("inventory")
        .update({ amount: after })
        .eq("id", line.item.id)
        .eq("amount", before)
        .select("id")
        .maybeSingle();
      if (updateError || !updated) {
        throw new Error(`${line.item.name} changed while the sale was being completed. Please try again.`);
      }
      inventoryChanges.push({ id: line.item.id, before, after });
    }

    console.log(`[Walk-in] ${order.order_number} completed by ${auth.userId}`);
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total,
      discountTotal,
      taxRate,
      taxAmount,
      soldByName,
    });
  } catch (error) {
    for (const change of inventoryChanges.reverse()) {
      const { error: restoreError } = await admin
        .from("inventory")
        .update({ amount: change.before })
        .eq("id", change.id)
        .eq("amount", change.after);
      if (restoreError) console.error(`[Walk-in] inventory rollback failed for ${change.id}:`, restoreError.message);
    }
    if (createdOrderId) {
      const { error: rollbackError } = await admin.from("orders").delete().eq("id", createdOrderId);
      if (rollbackError) console.error(`[Walk-in] order rollback failed for ${createdOrderId}:`, rollbackError.message);
    }

    const message = error instanceof Error ? error.message : "Could not complete the sale.";
    console.error("[Walk-in] sale error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
