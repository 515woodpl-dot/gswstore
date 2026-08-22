import { Suspense } from "react";
import Link from "next/link";
import {
  getStoreItems,
  getStoreCategories,
  getFeaturedItems,
  getHeroItems,
  getNewArrivals,
  getTopDeals,
} from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import PromoHero from "@/components/PromoHero";
import ProductRow from "@/components/ProductRow";
import NewsletterSignup from "@/components/NewsletterSignup";

export const revalidate = 5;

interface Props {
  searchParams: Promise<{ q?: string; cat?: string; account?: string }>;
  basePath: "/" | "/shop";
}

export default async function StorefrontPage({ searchParams, basePath }: Props) {
  const { q, cat, account } = await searchParams;
  const [items, cats, heroItems, featuredItems, newArrivals, deals] = await Promise.all([
    getStoreItems(),
    getStoreCategories(),
    getHeroItems(),
    getFeaturedItems(5),
    getNewArrivals(8),
    getTopDeals(8),
  ]);

  const buildUrl = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div>
      {account === "closed" && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          Your account has been closed. Thanks for shopping with us.
        </div>
      )}

      {/* Hero */}
      {heroItems.length > 0 && (
        <section className="bg-white px-4 pb-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <PromoHero items={heroItems} />
          </div>
        </section>
      )}

      {/* Staff Picks */}
      {featuredItems.length > 0 && (
        <section className="bg-[#2b353f] py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue">Featured</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Staff Picks</h2>
              </div>
              <a href="#catalog" className="text-sm font-semibold text-slate-400 transition hover:text-white">
                View all →
              </a>
            </div>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
              {featuredItems.map((item) => {
                const img = item.image_url || item.images?.[0];
                return (
                  <Link
                    key={item.id}
                    href={`/shop/product/${item.id}`}
                    className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-600 bg-slate-700 transition hover:border-brand-blue sm:w-52"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-600">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                      )}
                      {item.sale_price && (
                        <span className="absolute left-2 top-2 rounded-full bg-brand-blue px-2 py-0.5 text-[0.62rem] font-bold uppercase text-white">
                          Sale
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{item.name}</p>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        {item.sale_price ? (
                          <>
                            <span className="text-sm font-bold text-brand-blue">${item.sale_price.toFixed(2)}</span>
                            <span className="text-xs text-slate-400 line-through">${item.store_price.toFixed(2)}</span>
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

      {/* Deals / New Arrivals rows */}
      {deals.length > 0 && <ProductRow title="Top Deals" subtitle="Limited-time savings" items={deals} accent="primary" />}
      {newArrivals.length > 0 && <ProductRow title="Just In" subtitle="New Arrivals" items={newArrivals} accent="gold" />}

      {/* Catalog */}
      <section id="catalog" className="scroll-mt-16 border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Catalog</p>
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {q ? `Results for "${q}"` : cat ? cat : "All Products"}
              </h2>
            </div>
            {q && (
              <Link
                href={cat ? buildUrl({ cat }) : basePath}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                ✕ Clear search
              </Link>
            )}
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link
              href={q ? buildUrl({ q }) : basePath}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                !cat ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All
            </Link>
            {cats.map((c) => (
              <Link
                key={c.id}
                href={buildUrl({ cat: c.name, q })}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  cat === c.name ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          <Suspense>
            <ShopGrid items={items} cat={cat} q={q} basePath={basePath} />
          </Suspense>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  );
}
