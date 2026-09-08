import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sendReceiptEmail } from "@/lib/notifications";
import { BRAND } from "@/lib/brand";

// POST { orderId }  — sends receipt to customer AND always to shop inbox
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
      .select("order_number,total,discount_total,created_at,source,sold_by_name,walk_in_customer_id,user_id,order_items(name,quantity,unit_price,list_price,discount_amount)")
      .eq("id", orderId)
      .single();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    let customerEmail = "";
    let customerName = "";

    // Walk-in order — look up walk_in_customers
    if (order.walk_in_customer_id) {
      const { data: cust } = await sb
        .from("walk_in_customers")
        .select("name,email")
        .eq("id", order.walk_in_customer_id)
        .single();
      customerEmail = cust?.email || "";
      customerName = cust?.name || "";
    }

    // Online order — look up auth user
    if (!customerEmail && order.user_id) {
      const { data: { user } } = await sb.auth.admin.getUserById(order.user_id);
      if (user) {
        customerEmail = user.email || "";
        customerName = (user.user_metadata?.full_name as string) || "";
      }
    }

    const shopInbox = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;
    const receiptData = {
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
    };

    const sentTo: string[] = [];

    // Always send to shop inbox
    await sendReceiptEmail(receiptData, shopInbox, customerName || "Walk-in Customer");
    sentTo.push(shopInbox);

    // Also send to customer if they have an email
    if (customerEmail && customerEmail.includes("@") && customerEmail !== shopInbox) {
      await sendReceiptEmail(receiptData, customerEmail, customerName);
      sentTo.push(customerEmail);
    }

    return NextResponse.json({ ok: true, sent: true, to: sentTo });
  } catch (err) {
    console.error("[Receipt] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not send receipt." }, { status: 500 });
  }
}
