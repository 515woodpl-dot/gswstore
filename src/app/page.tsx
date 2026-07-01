import { Suspense } from "react";
import Link from "next/link";
import { getStoreItems, getStoreCategories, getFeaturedItems, getHeroItems, getNewArrivals, getTopDeals } from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import PromoHero from "@/components/PromoHero";
import ProductRow from "@/components/ProductRow";
import NewsletterSignup from "@/components/NewsletterSignup";

export const revalidate = 60;

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

export default async function HomePage({ searchParams }: Props) {
  const { q, cat } = await searchParams;
  const [items, cats, heroItems, featuredItems, newArrivals, deals] = await Promise.all([
    getStoreItems(),
    getStoreCategories(),
    getHeroItems(),       // max 3 — for the hero slideshow
    getFeaturedItems(5),  // max 5 — for the featured section
    getNewArrivals(8),
    getTopDeals(8),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-white px-4 pt-6 pb-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PromoHero items={heroItems} />
        </div>
      </section>

      {/* Featured Products — orange accent, contrasting BG */}
      {featuredItems.length > 0 && (
        <section className="bg-slate-900 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-primary">Featured</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Staff Picks</h2>
              </div>
              <a href="#catalog" className="text-sm font-semibold text-slate-400 hover:text-white transition">
                View all →
              </a>
            </div>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
              {featuredItems.map((item) => {
                const img = item.image_url || item.images?.[0];
                return (
                  <Link key={item.id} href={`/shop/product/${item.id}`}
                    className="group w-44 shrink-0 overflow-hidden rounded-2xl bg-slate-800 border border-slate-700 transition hover:border-brand-primary sm:w-52">
                    <div className="relative aspect-square overflow-hidden bg-slate-700">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                      )}
                      {item.sale_price && (
                        <span className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-0.5 text-[0.62rem] font-bold uppercase text-white">Sale</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{item.name}</p>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        {item.sale_price ? (
                          <>
                            <span className="text-sm font-bold text-brand-primary">${item.sale_price.toFixed(2)}</span>
                            <span className="text-xs text-slate-500 line-through">${item.store_price.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-white">${item.store_price.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Top Deals + New Arrivals */}
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

          {/* Category filter pills */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href={q ? `/?q=${q}` : "/"} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${!cat ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              All
            </Link>
            {cats.map((c) => (
              <Link key={c.id} href={q ? `/?cat=${encodeURIComponent(c.name)}&q=${q}` : `/?cat=${encodeURIComponent(c.name)}`}
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
