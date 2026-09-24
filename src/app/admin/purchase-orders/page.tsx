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
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 rounded-xl border border-[#e6e8ec] bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Inventory</p>
        <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Purchase Orders</h1>
        <p className="mt-1 text-xs text-[#5b6678]">Track inbound shipments. Receiving a PO updates cost prices and stock automatically.</p>
      </div>
      <PurchaseOrderManager
        initialPOs={pos ?? []}
        initialSuppliers={suppliers ?? []}
        inventoryItems={inventory ?? []}
      />
    </div>
  );
}
