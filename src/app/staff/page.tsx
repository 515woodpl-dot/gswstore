import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import RegisterSW from "@/components/RegisterSW";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

export default async function StaffLandingPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/staff");
    redirect("/?error=not_authorized");
  }

  const tiles = [
    {
      href: "/alerts",
      icon: "🔔",
      title: "Alerts",
      desc: "Incoming orders, status updates, and live queue",
      accent: "from-amber-500/10 to-amber-500/0 border-amber-200",
    },
    {
      href: "/admin",
      icon: "📦",
      title: "Inventory",
      desc: "Products, stock levels, pricing, and categories",
      accent: "from-sky-500/10 to-sky-500/0 border-sky-200",
    },
    {
      href: "/admin/walk-in",
      icon: "🛒",
      title: "Walk-in Sale",
      desc: "Ring up an in-store customer",
      accent: "from-emerald-500/10 to-emerald-500/0 border-emerald-200",
    },
    {
      href: "/admin/orders",
      icon: "📋",
      title: "Orders",
      desc: "Full order history and fulfillment",
      accent: "from-violet-500/10 to-violet-500/0 border-violet-200",
    },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdfb_0%,#f7fbfc_100%)]">
      <RegisterSW />

      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/gst-logo-horizontal.png"
            alt="Golden Stone Supply"
            className="mx-auto h-10 w-auto object-contain sm:h-12"
          />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
            Staff Portal
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Where to?
          </h1>
        </div>

        {/* Tiles */}
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br ${t.accent} bg-white p-5 shadow-sm transition active:scale-[0.98] sm:hover:shadow-md`}
            >
              <div>
                <span className="text-3xl">{t.icon}</span>
                <h2 className="mt-3 text-lg font-black tracking-tight text-slate-950">
                  {t.title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">{t.desc}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-navy">
                Open
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition group-hover:translate-x-0.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            ← View storefront
          </Link>
          <p className="text-center text-xs text-slate-400">
            Signed in as staff · Golden Stone Supply
          </p>
        </div>
      </div>
    </div>
  );
}
