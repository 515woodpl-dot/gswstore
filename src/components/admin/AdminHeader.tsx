"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import BrandLogo from "@/components/BrandLogo";

export default function AdminHeader() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const link = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link href={href}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-brand-gold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-brand-navy"}`}>
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <BrandLogo href="/admin" className="rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200" compact />
          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold uppercase text-white">Admin</span>
        </div>
        <nav className="flex items-center gap-2">
          {link("/admin", "Inventory")}
          {link("/admin/orders", "Orders")}
          {link("/admin/staff", "Staff")}
          <Link href="/alerts" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy">
            Alerts Screen
          </Link>
          <button onClick={signOut} className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Sign Out
          </button>
        </nav>
      </div>
    </header>
  );
}
