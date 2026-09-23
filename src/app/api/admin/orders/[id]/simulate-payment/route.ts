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

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: orderId } = await params;
  const admin = adminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,order_number,total,status,payment_status,is_test")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.is_test) return NextResponse.json({ error: "Payment simulation is only available for test orders." }, { status: 409 });
  if (["paid", "partially_refunded", "refunded"].includes(order.payment_status)) return NextResponse.json({ ok: true, alreadyPaid: true });
  if (order.status === "cancelled" || order.status === "completed") {
    return NextResponse.json({ error: `A ${order.status} order cannot be paid.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin.from("orders").update({
    payment_status: "paid",
    status: "processing",
    amount_paid: order.total,
    paid_at: now,
    square_payment_id: `TEST-${order.id}`,
    square_payment_link_status: "paid",
  }).eq("id", order.id).eq("is_test", true).in("payment_status", ["unpaid", "pending", "failed"]).select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) return NextResponse.json({ ok: true, alreadyPaid: true });

  const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
  const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
  await logOrderEvent(admin, {
    orderId: order.id,
    eventType: "test_payment_simulated",
    actorId: auth.userId,
    actorName,
    newValue: { amountPaid: Number(order.total) },
  });
  return NextResponse.json({ ok: true, amountPaid: Number(order.total) });
}
