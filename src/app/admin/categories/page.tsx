import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import CategoryManager from "@/components/admin/CategoryManager";
import type { Category } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/categories");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const { data: cats } = await sb.from("categories").select("id,name,prefix,color").order("name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Inventory</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
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

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <Link href="/admin" className="pb-3 px-4 text-sm font-semibold text-slate-500 hover:text-slate-900">Inventory</Link>
        <a href="/admin/categories" className="border-b-2 border-brand-navy pb-3 px-4 text-sm font-bold text-brand-navy">Categories</a>
      </div>

      <CategoryManager initialCategories={(cats ?? []) as Category[]} />
    </div>
  );
}
