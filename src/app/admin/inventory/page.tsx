import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import InventoryManager from "@/components/admin/InventoryManager";
import type { Category } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/inventory");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const [{ data: items }, { data: cats }] = await Promise.all([
    sb.from("inventory").select("*").order("id", { ascending: true }),
    sb.from("categories").select("id,name,prefix,color").order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e6e8ec] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Admin</p>
          <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Inventory</h1>
          <p className="mt-1 max-w-xl text-xs text-[#5b6678]">
            Manage stock, featured items, and store visibility from one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/orders" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">
            View Orders
          </Link>
          {auth.role === "owner" && (
            <Link href="/admin/staff" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">
              Staff
            </Link>
          )}
        </div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-[#e6e8ec]">
        <a href="/admin/inventory" className="border-b-2 border-brand-navy pb-3 px-4 text-sm font-bold text-brand-navy">Products</a>
        <a href="/admin/receiving" className="pb-3 px-4 text-sm font-semibold text-slate-500 hover:text-slate-900">Receive Stock</a>
        <a href="/admin/inventory/packaging" className="pb-3 px-4 text-sm font-semibold text-slate-500 hover:text-slate-900">Packaging Review</a>
        <a href="/admin/categories" className="pb-3 px-4 text-sm font-semibold text-slate-500 hover:text-slate-900">Categories</a>
      </div>
      <InventoryManager
        initialItems={items ?? []}
        categories={(cats ?? []) as Category[]}
      />
    </div>
  );
}
