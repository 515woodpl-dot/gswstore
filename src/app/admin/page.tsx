import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_NAV } from "@/lib/adminNav";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin");
    redirect("/?error=not_authorized");
  }

  // Quick stats for the dashboard header
  const sb = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: todayOrders }, { count: pendingOrders }, { data: lowStock }] = await Promise.all([
    sb.from("orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    sb.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "ready"]),
    sb.from("inventory").select("id").lt("amount", 10).gt("amount", 0).limit(99),
  ]);

  const stats = [
    { label: "Orders today", value: String(todayOrders ?? 0), accent: "text-emerald-700" },
    { label: "Pending orders", value: String(pendingOrders ?? 0), accent: pendingOrders ? "text-amber-700" : "text-slate-700" },
    { label: "Low stock items", value: String(lowStock?.length ?? 0), accent: lowStock?.length ? "text-rose-700" : "text-slate-700" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-gold">Golden Stone Supply</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-black ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Nav groups as cards */}
      <div className="space-y-8">
        {ADMIN_NAV.map((group) => (
          <div key={group.label}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`group flex items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 transition active:scale-[0.98] hover:shadow-md ${group.color}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl ${group.color}`}>
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-950">{item.label}</p>
                    <p className="mt-0.5 text-sm leading-5 text-slate-500">{item.description}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-navy">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Alerts shortcut */}
      <div className="mt-8 flex justify-center">
        <a href={BRAND.alertsUrl}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          🔔 Go to Alerts
        </a>
      </div>
    </div>
  );
}
