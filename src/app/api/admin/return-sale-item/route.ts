import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId, itemId, quantity, reason } = await request.json();
  const count = Number(quantity);
  if (typeof orderId !== "string" || typeof itemId !== "string" || !Number.isInteger(count) || count <= 0 ||
      typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "Choose a valid quantity and enter a reason." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin.rpc("return_completed_sale_item", {
    p_order_id: orderId,
    p_order_item_id: itemId,
    p_quantity: count,
    p_reason: reason.trim(),
    p_actor_id: auth.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, ...data });
}
