import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import WalkInPos from "@/components/admin/WalkInPos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Walk-in Checkout — Admin" };

export default async function WalkInPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/walk-in");
    redirect("/?error=not_authorized");
  }
  return <WalkInPos />;
}
