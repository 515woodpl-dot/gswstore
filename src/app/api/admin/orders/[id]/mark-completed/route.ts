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

  const { data: order } = await admin.from("orders").select("id,status,payment_status").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ error: "A cancelled order cannot be completed." }, { status: 409 });
  if (order.payment_status === "refunded") return NextResponse.json({ error: "A fully refunded order cannot be completed." }, { status: 409 });
  if (order.status === "completed") return NextResponse.json({ ok: true }); // idempotent
  if (order.status !== "ready" || !["paid", "partially_refunded"].includes(order.payment_status)) {
    return NextResponse.json({ error: "Only a paid order that is ready for pickup can be completed." }, { status: 409 });
  }

  const { error: updateError } = await admin.from("orders").update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", orderId).eq("status", "ready").in("payment_status", ["paid", "partially_refunded"]);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
  const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
  await logOrderEvent(admin, { orderId, eventType: "order_completed", actorId: auth.userId, actorName });
  return NextResponse.json({ ok: true });
}
