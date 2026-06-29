import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Service-role client — can read auth.users. Only ever used server-side after an owner check.
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireOwner() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, reason: "Not signed in" };
  const { data } = await sb.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!data || data.role !== "owner") return { ok: false as const, status: 403, reason: "Owners only" };
  return { ok: true as const, userId: user.id };
}

// GET — list all staff with their emails
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });

  const admin = adminClient();
  const { data: staff } = await admin.from("admin_users").select("user_id, role, created_at").order("created_at");
  if (!staff) return NextResponse.json({ staff: [] });

  // Resolve emails via the auth admin API
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersList?.users ?? []).map((u) => [u.id, u.email]));
  const nameById  = new Map((usersList?.users ?? []).map((u) => [u.id, (u.user_metadata?.full_name as string) ?? ""]));

  const result = staff.map((s) => ({
    user_id: s.user_id,
    role: s.role,
    created_at: s.created_at,
    email: emailById.get(s.user_id) ?? "(unknown)",
    full_name: nameById.get(s.user_id) ?? "",
  }));
  return NextResponse.json({ staff: result });
}

// POST — add staff by email  { email, role }
export async function POST(request: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });

  const { email, role } = await request.json();
  if (!email || !["owner", "staff"].includes(role))
    return NextResponse.json({ error: "Email and valid role required" }, { status: 400 });

  const admin = adminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const match = (usersList?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match)
    return NextResponse.json({ error: "No account with that email. They must sign up first." }, { status: 404 });

  const { error } = await admin.from("admin_users").upsert({ user_id: match.id, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove staff  { user_id }
export async function DELETE(request: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });

  const { user_id } = await request.json();
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  if (user_id === auth.userId)
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });

  const admin = adminClient();
  const { error } = await admin.from("admin_users").delete().eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
