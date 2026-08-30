import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { code } = await request.json();
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return NextResponse.json({ error: "Enter a discount code." }, { status: 400 });
  const sb = await createClient();
  const { data } = await sb.from("discount_codes").select("name,code,percent_off").eq("code", normalized).eq("active", true).maybeSingle();
  if (!data) return NextResponse.json({ error: "That code is not active." }, { status: 404 });
  return NextResponse.json({ name: data.name, code: data.code, percentOff: Number(data.percent_off) });
}
