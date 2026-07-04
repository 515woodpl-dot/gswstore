import { createClient } from "@/lib/supabase/server";

export async function isAdmin(): Promise<boolean> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("admin_users").select("user_id").eq("user_id", user.id).single();
  return !!data;
}

export async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" as const };
  const { data } = await sb.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!data) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, role: data.role as "owner" | "staff", userId: user.id };
}
