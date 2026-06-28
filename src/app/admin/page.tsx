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
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const [{ data: items }, { data: cats }] = await Promise.all([
    sb.from("inventory").select("*").order("id", { ascending: true }),
    sb.from("categories").select("id,name,prefix,color").order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Inventory</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/orders" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            View Orders
          </Link>
          {auth.role === "owner" && (
            <Link href="/admin/staff" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Staff
            </Link>
          )}
        </div>
      </div>
      <InventoryManager
        initialItems={items ?? []}
        categories={(cats ?? []) as Category[]}
      />
    </div>
  );
}
