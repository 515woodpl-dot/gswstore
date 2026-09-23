import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logOrderEvent } from "@/lib/order-events";
import { sendStatusEmail } from "@/lib/notifications";
import type { CustomerRow } from "@/lib/admin-order-types";

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

  // Atomic claim: only the request that actually flips ready_at from NULL
  // sends the email — refreshes/retries after that are no-ops.
  const { data: claimed } = await admin
    .from("orders")
    .update({ status: "ready", ready_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("ready_at", null)
    .in("status", ["processing", "awaiting_payment"])
    .in("payment_status", ["paid", "partially_refunded"])
    .select("*, order_items(*)")
    .maybeSingle();

  if (!claimed) {
    // Either already ready (idempotent no-op) or the order doesn't exist.
    const { data: existing } = await admin.from("orders").select("id,status,payment_status,ready_at").eq("id", orderId).single();
    if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (existing.ready_at) return NextResponse.json({ ok: true, alreadyReady: true });
    return NextResponse.json({ error: "Only a paid order in processing can be marked ready." }, { status: 409 });
  }

  const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
  const actorName = (authUser.user?.user_metadata?.full_name as string | undefined)?.trim() || authUser.user?.email?.split("@")[0] || "Staff";
  await logOrderEvent(admin, { orderId, eventType: "order_marked_ready", actorId: auth.userId, actorName });

  const { data: customer }: { data: CustomerRow | null } = claimed.walk_in_customer_id
    ? await admin.from("walk_in_customers").select("name,email").eq("id", claimed.walk_in_customer_id).single()
    : { data: null };
  if (customer?.email && !claimed.is_test) {
    try {
      await sendStatusEmail({ ...claimed, items: claimed.order_items }, customer.email, customer.name);
      await logOrderEvent(admin, { orderId, eventType: "ready_email_sent", actorId: auth.userId, actorName });
    } catch (e) {
      console.error("[MarkReady] ready email failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
