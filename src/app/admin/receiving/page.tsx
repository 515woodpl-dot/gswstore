import Link from "next/link";
import { redirect } from "next/navigation";
import ReceivingManager from "@/components/admin/ReceivingManager";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receive Stock" };

export default async function AdminReceivingPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/receiving");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const [productsResult, categoriesResult, receiptsResult] = await Promise.all([
    sb.from("inventory")
      .select("id,name,original_name,sku,amount,cost_price,store_price,base_unit,selling_unit,units_per_sale,packaging_reviewed")
      .order("name", { ascending: true }),
    sb.from("categories")
      .select("id,name,prefix,color")
      .order("name", { ascending: true }),
    sb.from("inventory_receipts")
      .select("id,receipt_code,supplier_name,supplier_invoice,received_date,shared_expenses,landed_total,inventory_receipt_items(id,inventory_id,original_name_snapshot,quantity_received,remaining_quantity,landed_unit_cost)")
      .order("received_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e6e8ec] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Inventory</p>
          <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Receive Stock</h1>
          <p className="mt-1 max-w-2xl text-xs text-[#5b6678]">
            Group a supplier shipment under one batch token and calculate each product&apos;s true landed cost.
          </p>
        </div>
        <Link href="/admin/inventory" className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand-blue hover:text-brand-blue">
          Back to products
        </Link>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-[#e6e8ec]">
        <Link href="/admin/inventory" className="whitespace-nowrap px-4 pb-3 text-sm font-semibold text-slate-500 hover:text-slate-900">Products</Link>
        <Link href="/admin/receiving" className="whitespace-nowrap border-b-2 border-brand-navy px-4 pb-3 text-sm font-bold text-brand-navy">Receive Stock</Link>
        <Link href="/admin/inventory/packaging" className="whitespace-nowrap px-4 pb-3 text-sm font-semibold text-slate-500 hover:text-slate-900">Packaging Review</Link>
        <Link href="/admin/categories" className="whitespace-nowrap px-4 pb-3 text-sm font-semibold text-slate-500 hover:text-slate-900">Categories</Link>
      </div>

      <ReceivingManager
        initialProducts={(productsResult.data ?? []).map((product) => ({
          ...product,
          original_name: product.original_name || product.name,
          amount: Number(product.amount) || 0,
          cost_price: Number(product.cost_price) || 0,
          store_price: Number(product.store_price) || 0,
        }))}
        categories={categoriesResult.data ?? []}
        recentReceipts={(receiptsResult.data ?? []).map((receipt) => ({
          ...receipt,
          shared_expenses: Number(receipt.shared_expenses) || 0,
          landed_total: Number(receipt.landed_total) || 0,
          inventory_receipt_items: (receipt.inventory_receipt_items ?? []).map((item) => ({
            ...item,
            quantity_received: Number(item.quantity_received) || 0,
            remaining_quantity: Number(item.remaining_quantity) || 0,
            landed_unit_cost: Number(item.landed_unit_cost) || 0,
          })),
        }))}
        setupError={[
          productsResult.error && `Products: ${productsResult.error.message}`,
          categoriesResult.error && `Categories: ${categoriesResult.error.message}`,
          receiptsResult.error && `Receipts: ${receiptsResult.error.message}`,
        ].filter(Boolean).join(" | ") || undefined}
      />
    </main>
  );
}
