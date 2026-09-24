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
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e6e8ec] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Sales</p>
          <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Check Placed Orders</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders/new" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90">
            + New Payment-Link Order
          </Link>
          <Link href="/admin/inventory" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">
            Manage Inventory
          </Link>
        </div>
      </div>
      <AdminOrdersList initialOrders={orders} />
    </div>
  );
}
