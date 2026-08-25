import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import AdminOrdersList from "@/components/admin/AdminOrdersList";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/orders");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const { data } = await sb
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  const orders: Order[] = (data ?? []).map((o) => ({ ...o, items: o.order_items }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Orders</h1>
        </div>
        <Link href="/admin/inventory" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">
          Manage Inventory
        </Link>
      </div>
      <AdminOrdersList initialOrders={orders} />
    </div>
  );
}
