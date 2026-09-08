import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import PurchaseOrderManager from "@/components/admin/PurchaseOrderManager";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/purchase-orders");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();

  const { data: pos } = await sb
    .from("purchase_orders")
    .select("*, po_items(*)")
    .order("created_at", { ascending: false });

  const { data: suppliers } = await sb
    .from("suppliers")
    .select("*")
    .order("name");

  const { data: inventory } = await sb
    .from("inventory")
    .select("id,name,sku,cost_price,store_price")
    .is("parent_id", null)
    .order("name");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Admin</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Purchase Orders</h1>
        <p className="mt-1 text-sm text-slate-500">Track inbound shipments. Receiving a PO updates cost prices and stock automatically.</p>
      </div>
      <PurchaseOrderManager
        initialPOs={pos ?? []}
        initialSuppliers={suppliers ?? []}
        inventoryItems={inventory ?? []}
      />
    </div>
  );
}
