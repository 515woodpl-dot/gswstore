import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a reseller permit file." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Use a PDF, JPG, or PNG permit file." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "The permit must be smaller than 10 MB." }, { status: 400 });

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-120) || "permit";
    const path = `permits/${auth.userId}/${crypto.randomUUID()}-${safeName}`;
    const admin = adminClient();
    const { error } = await admin.storage.from("reseller-permits").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, path, filename: file.name });
  } catch (error) {
    console.error("[ResellerPermit/upload]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The reseller permit could not be uploaded." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const path = request.nextUrl.searchParams.get("path")?.trim() || "";
  if (!/^permits\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[^/]+$/i.test(path)) {
    return NextResponse.json({ error: "Invalid permit path." }, { status: 400 });
  }
  const { data, error } = await adminClient().storage.from("reseller-permits").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Permit not found." }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
