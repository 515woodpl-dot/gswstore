import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sendReceiptEmail } from "@/lib/notifications";

// POST { orderId }  — looks up the completed sale and emails a receipt
// to the linked walk-in customer, if one has an email on file.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing order id." }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const sb = await createClient();

    const { data: order } = await sb
      .from("orders")
      .select("order_number,total,discount_total,created_at,source,sold_by_name,walk_in_customer_id,order_items(name,quantity,unit_price,list_price,discount_amount)")
      .eq("id", orderId)
      .single();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (!order.walk_in_customer_id) {
      return NextResponse.json({ ok: true, skipped: "no_customer" });
    }

    const { data: cust } = await sb
      .from("walk_in_customers")
      .select("name,email")
      .eq("id", order.walk_in_customer_id)
      .single();

    if (!cust?.email) return NextResponse.json({ ok: true, skipped: "no_email" });

    await sendReceiptEmail(
      {
        orderNumber: order.order_number,
        total: Number(order.total),
        discountTotal: Number(order.discount_total ?? 0),
        items: (order.order_items ?? []).map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          discount_amount: Number(i.discount_amount ?? 0),
        })),
        soldByName: order.sold_by_name ?? "",
        createdAt: order.created_at,
        source: order.source ?? "",
      },
      cust.email,
      cust.name ?? ""
    );

    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[Receipt] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not send receipt." }, { status: 500 });
  }
}
