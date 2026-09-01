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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Inventory</p><h1 className="text-3xl font-black tracking-tight text-slate-950">Packaging Review</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Confirm the units and package size for every existing product before relying on stock and profit numbers.</p></div>
        <Link href="/admin/inventory" className="w-fit rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Back to products</Link>
      </div>
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Could not load packaging data: {error.message}. Run MIGRATION_UNITS_PACKAGING_V2.sql in Supabase.</p> : <PackagingReview initialItems={(data ?? []).map((row) => ({ ...row, amount: Number(row.amount) || 0, units_per_sale: Number(row.units_per_sale) || 1, base_unit: row.base_unit || "Each", selling_unit: row.selling_unit || "Each", packaging_reviewed: Boolean(row.packaging_reviewed) }))} />}
    </main>
  );
}
