import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import StaffManager from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/staff");
    redirect("/?error=not_authorized");
  }
  if (auth.role !== "owner") redirect("/admin?error=owners_only");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Staff Access</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/inventory" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">Inventory</Link>
          <Link href="/admin/orders" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-gold hover:bg-brand-gold/5">Orders</Link>
        </div>
      </div>
      <StaffManager />
    </div>
  );
}
