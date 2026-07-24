"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { useState } from "react";

export default function AdminHeader() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/admin", label: "Inventory" },
    { href: "/admin/walk-in", label: "Walk-in" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/staff", label: "Staff" },
  ];

  const alertsUrl = BRAND.alertsUrl;

  return (
    <header className="border-b border-slate-200 bg-white/95 text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <BrandLogo href="/staff" className="rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200" compact />
          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold uppercase text-white">Admin</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${pathname === href ? "bg-brand-gold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-brand-navy"}`}>
              {label}
            </Link>
          ))}
          <a href={alertsUrl} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy">
            Alerts
          </a>
          <button onClick={signOut} className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Sign Out
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} className="rounded-lg border border-slate-200 p-2 md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M18 6L6 18M6 6l12 12"/> : <><path d="M3 12h18M3 6h18M3 18h18"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          <div className="mt-3 space-y-1">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${pathname === href ? "bg-brand-navy text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                {label}
              </Link>
            ))}
            <a href={alertsUrl} className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Alerts</a>
            <button onClick={signOut} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
