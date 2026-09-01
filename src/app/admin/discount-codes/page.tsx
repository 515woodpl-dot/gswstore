import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import DiscountCodesManager from "@/components/admin/DiscountCodesManager";

export default async function Page() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/auth/login?next=/admin/discount-codes");

  const sb = await createClient();
  const { data, error } = await sb.from("discount_codes").select("id,name,code,percent_off,active").order("created_at", { ascending: false });
  const setupError = error?.message.includes("discount_codes")
    ? "Discount codes are not set up yet. Run MIGRATION_DISCOUNT_CODES.sql in Supabase, then reload this page."
    : error?.message;

  return <DiscountCodesManager initialCodes={(data ?? []).map((item) => ({ ...item, percent_off: Number(item.percent_off) }))} setupError={setupError} />;
}
