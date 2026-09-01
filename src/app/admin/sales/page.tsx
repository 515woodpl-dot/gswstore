import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import SalesReport from "@/components/admin/SalesReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales Report — Admin" };

interface Props { searchParams: Promise<{ range?: string; from?: string; to?: string }> }

export default async function SalesPage({ searchParams }: Props) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/sales");
    redirect("/?error=not_authorized");
  }

  const { range = "last90", from, to } = await searchParams;

  // Resolve date window
  const now = new Date();
  let start: Date;
  const end = to ? new Date(to + "T23:59:59") : new Date();
  if (from) {
    start = new Date(from + "T00:00:00");
  } else if (range === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "week") {
    start = new Date(now); start.setDate(now.getDate() - 7);
  } else if (range === "last30") {
    start = new Date(now); start.setDate(now.getDate() - 30);
  } else if (range === "last90") {
    start = new Date(now); start.setDate(now.getDate() - 90);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (range === "all") {
    start = new Date(2000, 0, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1); // month
  }

  const sb = await createClient();
  const [ordersResult, inventoryResult] = await Promise.all([
    sb
    .from("orders")
    .select("id,order_number,created_at,total,discount_total,status,source,sold_by_name,transaction_type,internal_use_reason,walk_in_customer_id,order_items(id,item_id,name,sku,quantity,unit_price,list_price,cost_price,base_units_per_sale,discount_amount,discount_reason)")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .neq("status", "cancelled")
    .order("created_at", { ascending: false }),
    sb.from("inventory").select("id,name,amount").order("name"),
  ]);

  return (
    <SalesReport
      orders={ordersResult.data ?? []}
      inventory={inventoryResult.data ?? []}
      range={range}
      from={from ?? start.toISOString().slice(0, 10)}
      to={to ?? end.toISOString().slice(0, 10)}
      loadError={[
        ordersResult.error && `Sales: ${ordersResult.error.message}`,
        inventoryResult.error && `Inventory: ${inventoryResult.error.message}`,
      ].filter(Boolean).join(" | ") || undefined}
    />
  );
}
