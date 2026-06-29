"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function AdminHeader() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const link = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link href={href}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-white text-brand-navy" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        {label}
      </Link>
    );
  };

  return (
    <header className="bg-brand-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-lg font-black tracking-wide">Golden Stone Tools</Link>
          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold uppercase text-slate-950">Admin</span>
        </div>
        <nav className="flex items-center gap-2">
          {link("/admin", "Inventory")}
          {link("/admin/orders", "Orders")}
          {link("/admin/staff", "Staff")}
          <Link href="/alerts" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">
            Alerts Screen
          </Link>
          <button onClick={signOut} className="ml-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/90 transition hover:bg-white/10">
            Sign Out
          </button>
        </nav>
      </div>
    </header>
  );
}
