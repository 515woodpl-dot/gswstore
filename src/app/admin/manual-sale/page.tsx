import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import ManualSale from "@/components/admin/ManualSale";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Past Sale — Admin" };

export default async function ManualSalePage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/manual-sale");
    redirect("/?error=not_authorized");
  }
  return <ManualSale />;
}
