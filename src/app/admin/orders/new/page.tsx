import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import AdminPaymentOrderBuilder from "@/components/admin/AdminPaymentOrderBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Payment-Link Order — Admin" };

export default async function NewPaymentLinkOrderPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/orders/new");
    redirect("/?error=not_authorized");
  }
  return <AdminPaymentOrderBuilder />;
}
