import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logOrderEvent } from "@/lib/order-events";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: orderId } = await params;
  const { itemId } = await request.json();
  if (typeof itemId !== "string") return NextResponse.json({ error: "Choose an item to restore." }, { status: 400 });

  const admin = adminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,order_number,status,payment_status,is_test,order_items(id,item_id,name,quantity,base_units_per_sale,status,cancelled_quantity)")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "cancelled" || !["unpaid", "pending", "failed"].includes(order.payment_status) || order.is_test) {
    return NextResponse.json({ error: "Only a cancelled, unpaid live order can be restored this way." }, { status: 409 });
  }

  const item = order.order_items.find((candidate) => candidate.id === itemId);
  if (!item?.item_id || item.item_id.startsWith("manual-")) return NextResponse.json({ error: "This order item cannot be restored to inventory." }, { status: 409 });
  if (item.status !== "active" || Number(item.cancelled_quantity || 0) !== 0) {
    return NextResponse.json({ error: "This item was already cancelled or restored." }, { status: 409 });
  }

  const { data: inventory, error: inventoryError } = await admin
    .from("inventory")
    .select("id,units_per_sale")
    .eq("id", item.item_id)
    .single();
  if (inventoryError || !inventory) return NextResponse.json({ error: "The inventory product no longer exists." }, { status: 409 });

  const baseUnits = Number(item.quantity) * Math.max(1, Number(item.base_units_per_sale) || 1);
  const catalogUnitSize = Math.max(1, Number(inventory.units_per_sale) || 1);
  if (!Number.isInteger(baseUnits / catalogUnitSize)) {
    return NextResponse.json({ error: "This item's packaging changed and needs a manual inventory correction." }, { status: 409 });
  }

  // Claim the line before stock changes so a repeated click cannot restore twice.
  const { data: claimed, error: claimError } = await admin
    .from("order_items")
    .update({
      status: "cancelled",
      cancelled_quantity: item.quantity,
      cancellation_reason: "Legacy cancelled-order inventory repair",
      cancelled_at: new Date().toISOString(),
      cancelled_by: auth.userId,
    })
    .eq("id", item.id)
    .eq("order_id", orderId)
    .eq("status", "active")
    .eq("cancelled_quantity", 0)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) return NextResponse.json({ error: "This item was already restored or changed. Reload and try again." }, { status: 409 });

  const { error: restockError } = await admin.rpc("restock_packaged_inventory", {
    p_item_id: item.item_id,
    p_selling_qty: baseUnits / catalogUnitSize,
  });
  if (restockError) {
    await admin.from("order_items").update({
      status: "active", cancelled_quantity: 0, cancellation_reason: "", cancelled_at: null, cancelled_by: null,
    }).eq("id", item.id);
    return NextResponse.json({ error: `Inventory could not be restored: ${restockError.message}` }, { status: 500 });
  }

  const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
  const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
  await logOrderEvent(admin, {
    orderId, eventType: "order_cancelled", actorId: auth.userId, actorName,
    reason: `Inventory repair: restored ${baseUnits} base units of ${item.name} from cancelled unpaid order.`,
  });
  return NextResponse.json({ ok: true, baseUnitsRestocked: baseUnits });
}
