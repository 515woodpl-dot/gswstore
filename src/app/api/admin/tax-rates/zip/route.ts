import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { zip } = await request.json();
  if (!zip || zip.length !== 5) return NextResponse.json({ error: "Invalid ZIP" }, { status: 400 });
  const sb = await createClient();
  await sb.from("store_settings").upsert({ key: "store_zip", value: zip.trim() }, { onConflict: "key" });
  return NextResponse.json({ ok: true });
}
