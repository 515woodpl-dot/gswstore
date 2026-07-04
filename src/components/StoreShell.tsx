"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { SHOP_PHONE, SHOP_PHONE_RAW } from "@/lib/utils";

function navLinkClass(active: boolean) {
  return [
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition",
    active ? "bg-brand-gold text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand-navy",
  ].join(" ");
}

function mobileLinkClass(active: boolean) {
  return [
    "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition",
    active ? "text-brand-gold" : "text-slate-500",
  ].join(" ");
}

function CartGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2l2.1 10.5a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.5L21 8H6.2" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Staff screens (admin dashboard, alerts display) don't use the customer
  // storefront chrome — render them bare.
  const isStaffScreen = pathname.startsWith("/admin") || pathname.startsWith("/alerts")
    || (typeof window !== "undefined" && (window.location.hostname.startsWith("admin.") || window.location.hostname.startsWith("alerts.")));
  if (isStaffScreen) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3 sm:py-4">
            <BrandLogo href="/" className="rounded-2xl bg-white/80 p-1.5 shadow-sm ring-1 ring-slate-200" compact />

            {/* Search box — desktop, between logo and menu */}
            <form action="/" method="get" className="hidden flex-1 lg:block lg:max-w-md">
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition focus-within:border-brand-navy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input name="q" type="search" placeholder="Search tools, brands, SKUs…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </label>
            </form>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-2 lg:flex">
              <a href={`tel:${SHOP_PHONE_RAW}`}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy">
                📞 Call Us
              </a>
              {user ? (
                <>
                  <Link href="/account/orders" className={navLinkClass(pathname.startsWith("/account"))}>
                    My Orders
                  </Link>
                  <button
                    onClick={signOut}
                    className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className={navLinkClass(pathname.startsWith("/auth"))}>
                    Sign In
                  </Link>
                </>
              )}

              <Link
                href="/cart"
                aria-label="Cart"
                className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CartGlyph />
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount}
                </span>
              </Link>
            </nav>

            {/* Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                href="/cart"
                aria-label="Cart"
                className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CartGlyph />
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                aria-label="Open menu"
              >
                <span aria-hidden="true">☰</span>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="pb-4 lg:hidden">
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
                <form action="/" method="get" className="mb-1">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-brand-navy">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input name="q" type="search" placeholder="Search…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                  </label>
                </form>
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Shop</Link>
                <a href={`tel:${SHOP_PHONE_RAW}`} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">📞 Call Us</a>
                {user ? (
                  <>
                    <Link href="/account/orders" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">My Orders</Link>
                    <button onClick={() => { setMobileMenuOpen(false); signOut(); }} className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign Out</button>
                  </>
                ) : (
                  <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign In</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="pb-24 md:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
          <Link href="/cart" aria-label="Cart" className={mobileLinkClass(pathname === "/cart")}>
            Cart
            {itemCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-bold text-white">{itemCount}</span>}
          </Link>
          <Link
            href={user ? "/account/orders" : "/auth/login"}
            className={mobileLinkClass(pathname.startsWith("/account") || pathname.startsWith("/auth"))}
          >
            {user ? "Orders" : "Sign In"}
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <p className="text-lg font-bold text-brand-navy">{BRAND.name}</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Professional tools and equipment for crews, trades, and service teams. Order online and pick up in store.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Shop Categories</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Power Tools", "Hand Tools", "Measuring", "Safety"].map((name) => (
                <Link
                  key={name}
                  href={`/?cat=${encodeURIComponent(name)}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-slate-300"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Contact & Pickup</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every order is prepared for in-store pickup. No shipping — just the tools you need, ready at the counter.
            </p>
            <a href={`tel:${SHOP_PHONE_RAW}`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-navy hover:underline">
              📞 {SHOP_PHONE}
            </a>
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
