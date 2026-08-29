import { Suspense } from "react";
import Link from "next/link";
import {
  getStoreItems,
  getStoreCategories,
  getHeroItems,
  getNewArrivals,
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
  const [items, cats, heroItems, newArrivals] = await Promise.all([
    getStoreItems(),
    getStoreCategories(),
    getHeroItems(),
    getNewArrivals(8),
  ]);
  const promoItems = heroItems.length > 0 ? heroItems : items.slice(0, 1);

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
      {promoItems.length > 0 && (
        <section className="bg-[#fffaf5] px-4 pb-5 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <PromoHero items={promoItems} />
          </div>
        </section>
      )}

      {/* New arrivals */}
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
