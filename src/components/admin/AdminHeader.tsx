"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { useState, useRef, useEffect } from "react";

interface NavGroup {
  label: string;
  items: { href: string; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { href: "/admin/walk-in", label: "Walk-in Sale" },
      { href: "/admin/manual-sale", label: "Past Sale" },
      { href: "/admin/sales", label: "Sales Report" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/admin", label: "Products" },
      { href: "/admin/orders", label: "Orders" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/tax-rates", label: "Tax Rates" },
      { href: "/admin/staff", label: "Staff" },
    ],
  },
];

function DropdownGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = group.items.some((i) =>
    i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)
  );

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
          isActive ? "bg-brand-gold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-brand-navy"
        }`}
      >
        {group.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {group.items.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-brand-navy text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminHeader() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
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
          {NAV_GROUPS.map((group) => (
            <DropdownGroup key={group.label} group={group} pathname={pathname} />
          ))}
          <a href={alertsUrl}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy">
            Alerts
          </a>
          <button onClick={signOut}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Sign Out
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen((o) => !o)} className="rounded-lg border border-slate-200 p-2 md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <><path d="M3 12h18M3 6h18M3 18h18" /></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu — grouped */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="mb-1 px-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className={`block rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        active ? "bg-brand-navy text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
            <a href={alertsUrl} className="block rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Alerts
            </a>
            <button onClick={signOut} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
