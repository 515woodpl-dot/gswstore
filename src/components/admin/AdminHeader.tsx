"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { ADMIN_NAV } from "@/lib/adminNav";
import { useState, useRef, useEffect } from "react";

function activeAdminHref(pathname: string) {
  return ADMIN_NAV
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function DropdownGroup({ group, activeHref }: { group: typeof ADMIN_NAV[0]; activeHref: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = group.items.some((item) => item.href === activeHref);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold transition ${
          isActive ? "bg-[#b4532f] text-white" : "text-[#5b6678] hover:bg-[#f2f0ed] hover:text-[#0f172a]"
        }`}>
        {group.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-[#e6e8ec] bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,.12)]">
          {group.items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  active ? "bg-[#0f172a] text-white" : "text-[#5b6678] hover:bg-[#fbfaf8] hover:text-[#0f172a]"
                }`}>
                <span>{item.icon}</span>
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
  const activeHref = activeAdminHref(pathname);
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const alertsUrl = BRAND.alertsUrl;

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e8ec] bg-white/95 text-[#0f172a] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-3 sm:px-5 lg:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo href="/admin" className="shrink-0" compact />
          <span className="rounded-md bg-[#f4e5df] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9a4a14]">Admin</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {ADMIN_NAV.map((group) => (
            <DropdownGroup key={group.label} group={group} activeHref={activeHref} />
          ))}
          <a href={alertsUrl}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#5b6678] transition hover:bg-[#f2f0ed] hover:text-[#0f172a]">
            Alerts
          </a>
          <button onClick={signOut}
            className="ml-2 min-h-10 rounded-lg border border-[#e6e8ec] px-3 text-sm font-semibold text-[#0f172a] transition hover:bg-[#fbfaf8]">
            Sign Out
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle admin navigation" aria-expanded={mobileOpen} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#e6e8ec] md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <><path d="M3 12h18M3 6h18M3 18h18" /></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-[#e6e8ec] bg-white px-3 pb-4 md:hidden">
          {ADMIN_NAV.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5b6678]">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                        active ? "bg-[#0f172a] text-white" : "text-[#5b6678] hover:bg-[#fbfaf8]"
                      }`}>
                      <span>{item.icon}</span>{item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
            <a href={alertsUrl} className="block rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              🔔 Alerts
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
