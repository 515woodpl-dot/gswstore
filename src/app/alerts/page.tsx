import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import AlertsScreen from "@/components/AlertsScreen";
import RegisterSW from "@/components/RegisterSW";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order Alerts" };

export default async function AlertsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/alerts");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();
  const { data } = await sb
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(20);

  const recent: Order[] = (data ?? []).map((o) => ({ ...o, items: o.order_items }));

  return (
    <>
      <RegisterSW />
      <AlertsScreen initialOrders={recent} />
    </>
  );
}
