import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orderId, reason } = await request.json();
  if (!orderId) return NextResponse.json({ error: "Order is required." }, { status: 400 });
  const sb = await createClient();
  const { error } = await sb.from("orders").update({ transaction_type: "internal_use", internal_use_reason: String(reason || "").trim() }).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
