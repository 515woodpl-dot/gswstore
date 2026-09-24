import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_NAV } from "@/lib/adminNav";
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
    sb.from("orders").select("*", { count: "exact", head: true }).eq("is_test", false).gte("created_at", today.toISOString()),
    sb.from("orders").select("*", { count: "exact", head: true }).eq("is_test", false).in("status", ["pending", "confirmed", "ready"]),
    sb.from("inventory").select("id").lt("amount", 10).gt("amount", 0).limit(99),
  ]);

  const stats = [
    { label: "Orders today", value: String(todayOrders ?? 0), detail: "Created since midnight", accent: "text-[#23694a]" },
    { label: "Pending orders", value: String(pendingOrders ?? 0), detail: "Need payment or fulfillment", accent: pendingOrders ? "text-[#9a4a14]" : "text-[#0f172a]" },
    { label: "Low stock", value: String(lowStock?.length ?? 0), detail: "Products below 10 units", accent: lowStock?.length ? "text-[#b4233a]" : "text-[#0f172a]" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4532f]">Stone Product Supply</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[#0f172a]">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-[#5b6678]">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Link href="/admin/orders/new" className="flex min-h-11 items-center rounded-lg bg-[#0f172a] px-4 text-sm font-bold text-white hover:bg-slate-800">+ Payment-link order</Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#e6e8ec] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b6678]">{s.label}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className={`text-[28px] font-black leading-none tabular-nums ${s.accent}`}>{s.value}</p>
              <p className="text-right text-[10px] text-[#5b6678]">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {ADMIN_NAV.map((group) => (
          <section key={group.label} className="overflow-hidden rounded-xl border border-[#e6e8ec] bg-white">
            <div className="flex h-11 items-center justify-between border-b border-[#e6e8ec] bg-[#fbfaf8] px-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f172a]">{group.label}</h2>
              <span className="text-[10px] tabular-nums text-[#5b6678]">{group.items.length} tools</span>
            </div>
            <div className="divide-y divide-[#eef0f2]">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className="group flex min-h-[72px] items-center gap-3 px-4 py-3 transition hover:bg-[#fbfaf8]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f2f0ed] text-lg">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0f172a]">{item.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#5b6678]">{item.description}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#b4532f]">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
