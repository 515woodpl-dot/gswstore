import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { cancelPaymentLink } from "@/lib/square-checkout";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: orderId } = await params;
  const admin = adminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,is_test,square_payment_link_id,square_payment_link_status,reseller_permit_path")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.is_test) {
    return NextResponse.json({ error: "Only test orders can be permanently deleted here." }, { status: 409 });
  }

  try {
    if (order.square_payment_link_id && order.square_payment_link_status === "active") {
      await cancelPaymentLink(order.square_payment_link_id, "sandbox");
    }
    const { data: deleted, error: cleanupError } = await admin.rpc(
      "delete_test_order_and_restore_inventory",
      { p_order_id: orderId },
    );
    if (cleanupError) throw new Error(cleanupError.message);
    if (!deleted) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.reseller_permit_path) {
      const { error: permitError } = await admin.storage.from("reseller-permits").remove([order.reseller_permit_path]);
      if (permitError) console.warn("[TestOrder] permit cleanup failed:", permitError.message);
    }
    console.log(`[TestOrder] ${orderId} deleted by ${auth.userId}; reserved inventory restored`);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the test order.";
    console.error("[TestOrder/delete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
