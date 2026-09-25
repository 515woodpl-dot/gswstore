"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/lib/brand";
import { SHOP_PHONE, SHOP_PHONE_RAW } from "@/lib/utils";

function SearchGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" d="m16 16 5 5" /></svg>;
}

function AccountGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><circle cx="12" cy="8" r="3.5" /><path strokeLinecap="round" d="M5 20c.6-4 3-6 7-6s6.4 2 7 6" /></svg>;
}

function CartGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2 10h10.5l2-7H6" /><circle cx="9" cy="19" r="1.2" fill="currentColor" stroke="none" /><circle cx="17" cy="19" r="1.2" fill="currentColor" stroke="none" /></svg>;
}

export function StoreShell({ children, categories = [], promotion = null }: { children: ReactNode; categories?: { id: string; name: string }[]; promotion?: { name: string; code: string; percentOff: number } | null }) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, signOut } = useAuth();
  const isStaffScreen = pathname.startsWith("/admin") || pathname.startsWith("/alerts")
    || (typeof window !== "undefined" && (window.location.hostname.startsWith("admin.") || window.location.hostname.startsWith("alerts.")));
  if (isStaffScreen) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-brand-navy">
      <header className="relative z-40 border-b border-[#d7dbdd] bg-[#fbfaf7]/95 backdrop-blur">
        <div className="flex min-h-10 items-center justify-center gap-8 bg-brand-navy px-4 py-2 text-center text-[11px] text-white/75">
          <p className="m-0 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.13)]" />
            {promotion ? <>{promotion.name}: save {promotion.percentOff}% with <b className="text-white">{promotion.code}</b></> : <>Order by 4 PM for same-day pickup in Auburn.</>}
          </p>
          <a href={`tel:${SHOP_PHONE_RAW}`} className="hidden font-bold text-white hover:text-brand-gold sm:block">Need help? {SHOP_PHONE}</a>
        </div>

        <div className="mx-auto flex min-h-[88px] max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <BrandLogo href="/" className="shrink-0" compact />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            <Link href="/shop" className={`border-b-2 px-3 py-3 text-sm font-bold transition ${pathname.startsWith("/shop") ? "border-brand-gold text-brand-navy" : "border-transparent text-slate-600 hover:border-brand-gold"}`}>Shop</Link>
            <Link href="/about" className={`border-b-2 px-3 py-3 text-sm font-bold transition ${pathname === "/about" ? "border-brand-gold text-brand-navy" : "border-transparent text-slate-600 hover:border-brand-gold"}`}>About</Link>
          </nav>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link href="/account/orders" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand-gold"><AccountGlyph /> Orders</Link>
                <button onClick={signOut} className="text-xs font-bold text-slate-500 hover:text-brand-gold">Sign out</button>
              </div>
            ) : (
              <Link href="/auth/login" className="hidden items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand-gold sm:inline-flex"><AccountGlyph /> Account</Link>
            )}
            <Link href="/cart" aria-label={`Cart with ${itemCount} items`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-brand-gold">
              <CartGlyph /><span className="hidden sm:inline">Cart</span><b className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-gold px-1.5 text-[10px] text-white">{itemCount}</b>
            </Link>
          </div>
        </div>

        <nav className="flex items-center justify-center gap-8 border-t border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
          <Link href="/shop" className="text-xs font-bold text-slate-700 hover:text-brand-gold">Shop</Link>
          <Link href="/about" className="text-xs font-bold text-slate-700 hover:text-brand-gold">About</Link>
          <Link href={user ? "/account/orders" : "/auth/login"} className="text-xs font-bold text-slate-700 hover:text-brand-gold">{user ? "My orders" : "Sign in"}</Link>
        </nav>

        <div className="mx-auto max-w-7xl border-x border-t border-[#d7dbdd]">
          <form action="/#catalog" method="get" className="grid min-h-[62px] grid-cols-[auto_1fr_auto] items-center gap-3 bg-white pl-4 sm:pl-6">
            <span className="text-brand-blue"><SearchGlyph /></span>
            <label className="sr-only" htmlFor="store-search">Search the catalog</label>
            <input id="store-search" name="q" type="search" placeholder="Search by product, brand, or SKU" className="min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            <button type="submit" className="h-full bg-brand-blue px-4 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-brand-gold sm:px-6">Search<span className="hidden sm:inline"> catalog</span></button>
          </form>
        </div>
      </header>

      <main>{children}</main>

      <footer id="contact" className="bg-brand-gold text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16 lg:px-8">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gst-logo-horizontal.png" alt={BRAND.name} className="h-auto w-full max-w-[310px]" />
            <p className="mt-5 max-w-sm text-sm leading-6">Tools, materials, and no-nonsense help for the stone trade.</p>
          </div>
          <div><p className="font-display text-sm font-black uppercase tracking-wide text-white">Visit the counter</p><p className="mt-4 text-xs leading-6">{BRAND.address}</p><p className="mt-2 text-xs">Mon–Fri, 7:00 AM–5:00 PM</p></div>
          <div>
            <p className="font-display text-sm font-black uppercase tracking-wide text-white">Shop categories</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">{categories.slice(0, 6).map((category) => <Link key={category.id} href={`/shop?cat=${encodeURIComponent(category.name)}#catalog`} className="hover:text-white">{category.name}</Link>)}</div>
            <Link href="/about" className="mt-4 block text-xs font-bold hover:text-white">About us</Link>
            <a href={`tel:${SHOP_PHONE_RAW}`} className="mt-3 block text-xs font-bold text-white hover:text-brand-navy">{SHOP_PHONE}</a>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 border-t border-white/20 px-4 py-5 text-[10px] sm:flex-row sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} {BRAND.name}</p><p>Pickup-first supply for working crews.</p></div>
      </footer>
    </div>
  );
}
