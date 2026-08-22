import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing order ID." }, { status: 400 });

    const sb = await createClient();

    const { data: order } = await sb
      .from("orders")
      .select("id,source,status,order_items(item_id,quantity)")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.source !== "walk_in" && order.source !== "manual") {
      return NextResponse.json({ error: "Only walk-in and manual sales can be removed." }, { status: 400 });
    }

    // Restore inventory for completed orders
    if (order.status === "completed" && order.order_items) {
      for (const item of order.order_items as { item_id: string; quantity: number }[]) {
        if (item.item_id && !item.item_id.startsWith("manual-")) {
          const { data: inv } = await sb
            .from("inventory")
            .select("amount")
            .eq("id", item.item_id)
            .single();
          if (inv) {
            await sb
              .from("inventory")
              .update({ amount: inv.amount + item.quantity })
              .eq("id", item.item_id);
          }
        }
      }
    }

    await sb.from("order_items").delete().eq("order_id", orderId);
    await sb.from("orders").delete().eq("id", orderId);

    console.log(`[Admin] Walk-in sale ${orderId} deleted by ${auth.userId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Admin] delete sale error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not delete the sale." }, { status: 500 });
  }
}
