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
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e6e8ec] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Settings</p>
          <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Staff Access</h1>
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
