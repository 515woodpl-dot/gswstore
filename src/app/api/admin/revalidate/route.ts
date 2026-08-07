import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

// Called after admin saves inventory changes to bust the storefront cache immediately.
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  revalidatePath("/");
  revalidatePath("/shop");
  return NextResponse.json({ ok: true });
}
