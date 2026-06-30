import { Suspense } from "react";
import Link from "next/link";
import { getStoreItems, getStoreCategories, getFeaturedItems, getNewArrivals, getTopDeals } from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import PromoHero from "@/components/PromoHero";
import ProductRow from "@/components/ProductRow";
import NewsletterSignup from "@/components/NewsletterSignup";

export const revalidate = 60;

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

export default async function HomePage({ searchParams }: Props) {
  const { q, cat } = await searchParams;
  const [items, cats, featured, newArrivals, deals] = await Promise.all([getStoreItems(), getStoreCategories(), getFeaturedItems(5), getNewArrivals(8), getTopDeals(8)]);

  return (
    <div>
      {/* Hero — featured products promo banner */}
      <section className="relative bg-white">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <PromoHero items={featured} />
          <div className="mt-5 flex flex-wrap items-center justify-center gap-5 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-500 sm:justify-start">
            <span>🏪 Auburn, WA</span>
            <span>⚡ Order Online · In-Store Pickup</span>
            <span>🔧 {items.length} Products</span>
            <a href={`tel:${process.env.NEXT_PUBLIC_SHOP_PHONE?.replace(/[^+\d]/g,"") || "+12534496246"}`} className="text-brand-navy hover:underline">📞 Call Us</a>
          </div>
        </div>
      </section>

      {/* Deals + Arrivals — compact */}
      {deals.length > 0 && <ProductRow title="Top Deals" subtitle="Limited-time savings" items={deals} accent="primary" />}
      {newArrivals.length > 0 && <ProductRow title="Just In" subtitle="New Arrivals" items={newArrivals} accent="gold" />}

      {/* Catalog */}
      <section id="catalog" className="scroll-mt-16 border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Catalog</p>
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {cats.length > 0 ? `${items.length} products across ${cats.length} categories` : "All Products"}
              </h2>
            </div>
            <form action="/" method="get" className="w-full sm:w-auto">
              {cat && <input type="hidden" name="cat" value={cat} />}
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-brand-navy sm:w-[340px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input name="q" type="search" defaultValue={q || ""} placeholder="Search tools, brands, SKUs…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </label>
            </form>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href="/" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${!cat ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              All
            </Link>
            {cats.map((c) => (
              <Link key={c.id} href={`/?cat=${encodeURIComponent(c.name)}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${cat === c.name ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {c.name}
              </Link>
            ))}
          </div>

          <Suspense>
            <ShopGrid items={items} cat={cat} q={q} />
          </Suspense>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  );
}
