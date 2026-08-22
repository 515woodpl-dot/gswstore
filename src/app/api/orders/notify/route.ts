import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderConfirmationEmail } from "@/lib/notifications";
import type { Order } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: orderRow, error } = await supabase
      .from("orders").select("*, order_items(*)").eq("id", order_id).eq("user_id", user.id).single();
    if (error || !orderRow) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order: Order = { ...orderRow, items: orderRow.order_items };
    const customerEmail = user.email ?? "";
    const customerName = (user.user_metadata?.full_name as string) ?? "";
    // Customer confirmation email. The alerts screen is notified via Supabase
    // Realtime (no webhook needed) — orders are broadcast on insert.
    await sendOrderConfirmationEmail(order, customerEmail, customerName).catch((e) => {
      console.error("[Notify] email send failed:", e instanceof Error ? e.message : e);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/orders/notify]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
