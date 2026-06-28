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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Staff Access</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Inventory</Link>
          <Link href="/admin/orders" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Orders</Link>
        </div>
      </div>
      <StaffManager />
    </div>
  );
}
