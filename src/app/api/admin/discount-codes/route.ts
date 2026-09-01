import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

function databaseError(message: string) {
  if (message.includes("discount_codes") && (message.includes("does not exist") || message.includes("relation"))) {
    return "Discount codes are not set up yet. Run MIGRATION_DISCOUNT_CODES.sql in Supabase, then reload this page.";
  }
  return message;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, code, percentOff } = await request.json();
  const normalizedName = String(name || "").trim();
  const normalizedCode = String(code || "").trim().toUpperCase();
  const percent = Number(percentOff);

  if (!normalizedName) return NextResponse.json({ error: "Enter a campaign name." }, { status: 400 });
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) {
    return NextResponse.json({ error: "Use 3 to 32 letters, numbers, hyphens, or underscores for the code." }, { status: 400 });
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return NextResponse.json({ error: "Discount percent must be between 1 and 100." }, { status: 400 });
  }

  const sb = await createClient();
  const { data, error } = await sb
    .from("discount_codes")
    .insert({ name: normalizedName, code: normalizedCode, percent_off: percent })
    .select("id,name,code,percent_off,active")
    .single();
  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 });

  return NextResponse.json({ code: { ...data, percent_off: Number(data.percent_off) } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, active } = await request.json();
  if (!id || typeof active !== "boolean") return NextResponse.json({ error: "Invalid discount code update." }, { status: 400 });

  const sb = await createClient();
  const { data, error } = await sb
    .from("discount_codes")
    .update({ active })
    .eq("id", id)
    .select("id,name,code,percent_off,active")
    .single();
  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 });

  return NextResponse.json({ code: { ...data, percent_off: Number(data.percent_off) } });
}
