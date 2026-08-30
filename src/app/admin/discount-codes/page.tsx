import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import DiscountCodesManager from "@/components/admin/DiscountCodesManager";
export default async function Page() { const auth = await requireAdmin(); if (!auth.ok) redirect("/auth/login?next=/admin/discount-codes"); const sb = await createClient(); const { data } = await sb.from("discount_codes").select("id,name,code,percent_off,active").order("created_at", { ascending: false }); return <DiscountCodesManager initialCodes={(data ?? []).map((x) => ({ ...x, percent_off: Number(x.percent_off) }))} />; }
