import Link from "next/link";
import { redirect } from "next/navigation";
import PackagingReview from "@/components/admin/PackagingReview";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packaging Review" };

export default async function PackagingReviewPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/inventory/packaging");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const { data, error } = await sb.from("inventory")
    .select("id,name,sku,category_name,amount,base_unit,selling_unit,units_per_sale,packaging_reviewed,parent_id")
    .order("category_name", { ascending: true })
    .order("name", { ascending: true });

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e6e8ec] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Inventory</p><h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Packaging Review</h1><p className="mt-1 max-w-xl text-xs text-[#5b6678]">Confirm the units and package size for every existing product before relying on stock and profit numbers.</p></div>
        <Link href="/admin/inventory" className="w-fit rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Back to products</Link>
      </div>
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Could not load packaging data: {error.message}. Run MIGRATION_UNITS_PACKAGING_V2.sql in Supabase.</p> : <PackagingReview initialItems={(data ?? []).map((row) => ({ ...row, amount: Number(row.amount) || 0, units_per_sale: Number(row.units_per_sale) || 1, base_unit: row.base_unit || "Each", selling_unit: row.selling_unit || "Each", packaging_reviewed: Boolean(row.packaging_reviewed) }))} />}
    </main>
  );
}
