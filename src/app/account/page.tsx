import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/account");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Account</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">My Account</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Profile</p>
          <p className="mt-3 font-bold text-slate-950">{user.user_metadata?.full_name || "—"}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <Link href="/account/orders" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Orders</p>
          <p className="mt-3 font-bold text-slate-950">My Orders</p>
          <p className="text-sm text-slate-600">View your pickup order history →</p>
        </Link>
      </div>
    </div>
  );
}
