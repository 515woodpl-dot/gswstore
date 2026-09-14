import { Suspense } from "react";
import Link from "next/link";
import {
  getStoreItems,
  getStoreCategories,
  getHeroItems,
  getNewArrivals,
} from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import ProductRow from "@/components/ProductRow";
import NewsletterSignup from "@/components/NewsletterSignup";
import TradeHero from "@/components/TradeHero";

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

  const buildUrl = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const query = search.toString();
    return `${query ? `${basePath}?${query}` : basePath}#catalog`;
  };

  return (
    <div>
      {account === "closed" && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
          Your account has been closed. Thanks for shopping with us.
        </div>
      )}

      <TradeHero items={heroItems} />

      <section className="bg-[#dfe8ed]">
        <div className="mx-auto grid max-w-7xl divide-y divide-brand-blue/15 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          <p className="grid min-h-24 grid-cols-[34px_1fr] content-center py-5 text-[10px] leading-4 text-slate-600 sm:px-6 sm:first:pl-0"><span className="row-span-2 font-display font-black text-brand-gold">01</span><b className="text-xs text-brand-navy">Live local inventory</b>Know what&apos;s here before you drive.</p>
          <p className="grid min-h-24 grid-cols-[34px_1fr] content-center py-5 text-[10px] leading-4 text-slate-600 sm:px-6"><span className="row-span-2 font-display font-black text-brand-gold">02</span><b className="text-xs text-brand-navy">Trade-grade selection</b>Products chosen for real job sites.</p>
          <p className="grid min-h-24 grid-cols-[34px_1fr] content-center py-5 text-[10px] leading-4 text-slate-600 sm:px-6 sm:last:pr-0"><span className="row-span-2 font-display font-black text-brand-gold">03</span><b className="text-xs text-brand-navy">Fast counter pickup</b>We stage your order ahead of time.</p>
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && <ProductRow title="Just In" subtitle="New Arrivals" items={newArrivals} accent="gold" />}

      {/* Catalog */}
      <section id="catalog" className="scroll-mt-24 bg-brand-navy py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">On the shelf now</p>
              <h2 className="font-display mt-2 text-4xl font-black uppercase leading-none tracking-[-0.05em] text-white sm:text-6xl">
                {q ? `Results for "${q}"` : cat ? cat : "All Products"}
              </h2>
            </div>
            {q && (
              <Link
                href={cat ? buildUrl({ cat }) : `${basePath}#catalog`}
                className="inline-flex w-fit items-center gap-2 border border-white/25 px-4 py-2 text-xs font-bold text-white hover:border-white"
              >
                ✕ Clear search
              </Link>
            )}
          </div>

          <div className="-mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link
              href={q ? buildUrl({ q }) : `${basePath}#catalog`}
              className={`shrink-0 border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                !cat ? "border-brand-gold bg-brand-gold text-white" : "border-white/20 text-white/60 hover:border-white/60 hover:text-white"
              }`}
            >
              All
            </Link>
            {cats.map((c) => (
              <Link
                key={c.id}
                href={buildUrl({ cat: c.name, q })}
                className={`shrink-0 border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                  cat === c.name ? "border-brand-gold bg-brand-gold text-white" : "border-white/20 text-white/60 hover:border-white/60 hover:text-white"
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
