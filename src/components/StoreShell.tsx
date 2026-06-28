"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

function navLinkClass(active: boolean) {
  return [
    "rounded-full px-4 py-2 text-sm font-medium transition",
    active ? "bg-white text-brand-navy shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white",
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top notice bar */}
      <div className="bg-brand-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] sm:px-6 lg:px-8">
          <span>Golden Stone Tools</span>
          <span>In-store pickup only</span>
        </div>
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-brand-navy text-white backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Link href="/" className="text-xl font-black tracking-wide text-white">
              Golden Stone Tools
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-2 lg:flex">
              <Link href="/" className={navLinkClass(pathname === "/")}>Shop</Link>

              {user ? (
                <>
                  <Link href="/account/orders" className={navLinkClass(pathname.startsWith("/account"))}>
                    My Orders
                  </Link>
                  <button
                    onClick={signOut}
                    className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
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
                className="relative inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <CartGlyph />
                Cart
                <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-navy">
                  {itemCount}
                </span>
              </Link>
            </nav>

            {/* Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                href="/cart"
                className="relative inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <CartGlyph />
                Cart
                <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-navy">
                  {itemCount}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Menu
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="pb-4 lg:hidden">
              <div className="grid gap-2 rounded-2xl bg-white/10 p-3">
                <Link href="/" className="rounded-xl px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Shop</Link>
                {user ? (
                  <>
                    <Link href="/account/orders" className="rounded-xl px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">My Orders</Link>
                    <button onClick={signOut} className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-white hover:bg-white/10">Sign Out</button>
                  </>
                ) : (
                  <Link href="/auth/login" className="rounded-xl px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Sign In</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <p className="text-lg font-bold text-brand-navy">Golden Stone Tools</p>
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Pickup Notice</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every order is prepared for in-store pickup. No shipping — just the tools you need, ready at the counter.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Golden Stone Tools. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
