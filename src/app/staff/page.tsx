import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/brand";
import RegisterSW from "@/components/RegisterSW";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

export default async function StaffLandingPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/staff");
    redirect("/?error=not_authorized");
  }

  // Absolute URLs so links resolve correctly no matter which subdomain
  // the installed PWA is running on.
  const site = BRAND.siteUrl.replace(/\/$/, "");

  const tiles = [
    {
      href: `${site}/alerts`,
      icon: "🔔",
      title: "Alerts",
      desc: "Incoming orders and live queue",
      ring: "ring-amber-200",
      bg: "bg-amber-50",
    },
    {
      href: `${site}/admin/inventory`,
      icon: "📦",
      title: "Inventory",
      desc: "Products, stock, and pricing",
      ring: "ring-sky-200",
      bg: "bg-sky-50",
    },
    {
      href: `${site}/admin/walk-in`,
      icon: "🛒",
      title: "Walk-in Sale",
      desc: "Ring up an in-store customer",
      ring: "ring-emerald-200",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdfb_0%,#f7fbfc_100%)]">
      <RegisterSW />

      <div className="mx-auto w-full max-w-md px-5 py-10 sm:max-w-2xl sm:py-14">
        {/* Header */}
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="flex w-full justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/gst-logo-horizontal.png"
              alt="Stone Product Supply"
              width={1530}
              height={348}
              className="h-12 w-auto max-w-[240px] object-contain sm:h-14 sm:max-w-[300px]"
            />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
            Staff Portal
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Where to?
          </h1>
        </header>

        {/* Tiles */}
        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className={`group flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ${t.ring} transition active:scale-[0.98] sm:flex-col sm:items-start sm:gap-0 sm:hover:shadow-md`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${t.bg} sm:mb-3`}
              >
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black tracking-tight text-slate-950">
                  {t.title}
                </span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-500">
                  {t.desc}
                </span>
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-navy sm:hidden"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>

        {/* Storefront link */}
        <div className="mt-5 flex justify-center">
          <a
            href={site}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            🏪 View storefront
          </a>
        </div>
      </div>
    </div>
  );
}
