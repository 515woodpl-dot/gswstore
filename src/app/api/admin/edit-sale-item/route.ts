import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

// POST { itemId, newUnitPrice, discountReason }
// Updates a single order_item's sold price, recomputes its discount,
// then recomputes the parent order's total + discount_total.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { itemId, newUnitPrice, discountReason } = await request.json();
    const price = Number(newUnitPrice);
    if (!itemId || isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Invalid price." }, { status: 400 });
    }

    const sb = await createClient();

    // Fetch the line item
    const { data: item, error: itemErr } = await sb
      .from("order_items")
      .select("id,order_id,quantity,list_price,unit_price")
      .eq("id", itemId)
      .single();
    if (itemErr || !item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const list = item.list_price != null ? Number(item.list_price) : price;
    const qty = Number(item.quantity);
    const newDiscount = Math.max(0, (list - price) * qty);

    // Update the line item
    const { error: updErr } = await sb
      .from("order_items")
      .update({
        unit_price: price,
        discount_amount: newDiscount,
        discount_reason: newDiscount > 0 ? (discountReason || "").trim() : "",
      })
      .eq("id", itemId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Recompute the order's total + discount from all its items
    const { data: allItems } = await sb
      .from("order_items")
      .select("unit_price,quantity,discount_amount")
      .eq("order_id", item.order_id);

    const newTotal = (allItems ?? []).reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0);
    const newDiscountTotal = (allItems ?? []).reduce((s, it) => s + Number(it.discount_amount), 0);

    const { error: orderErr } = await sb
      .from("orders")
      .update({ total: newTotal, discount_total: newDiscountTotal })
      .eq("id", item.order_id);
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    console.log(`[Sale] item ${itemId} price edited to ${price} by ${auth.userId}`);
    return NextResponse.json({
      ok: true,
      unit_price: price,
      discount_amount: newDiscount,
      order_total: newTotal,
      order_discount_total: newDiscountTotal,
    });
  } catch (err) {
    console.error("[Sale] edit error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not update the sale." }, { status: 500 });
  }
}
