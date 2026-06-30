import { Suspense } from "react";
import Link from "next/link";
import { getStoreItems, getStoreCategories, getFeaturedItems, getNewArrivals, getTopDeals } from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import FeaturedSlideshow from "@/components/FeaturedSlideshow";
import ProductRow from "@/components/ProductRow";
import NewsletterSignup from "@/components/NewsletterSignup";

export const revalidate = 60;

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

export default async function HomePage({ searchParams }: Props) {
  const { q, cat } = await searchParams;
  const [items, cats, featured, newArrivals, deals] = await Promise.all([getStoreItems(), getStoreCategories(), getFeaturedItems(5), getNewArrivals(8), getTopDeals(8)]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/* Subtle background accent */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(67,93,105,0.07),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 py-12 lg:grid-cols-[1fr_480px] lg:gap-14 lg:py-20">

            {/* Left — headline + CTA */}
            <div className="flex flex-col justify-center">
              {/* Pickup badge */}
              <div className="mb-6 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-brand-navy/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
                  In-Store Pickup Only
                </span>
              </div>

              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Trade-grade tools,<br />
                <span className="text-brand-navy">ready when you are.</span>
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href="#catalog"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-navy px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                  Shop the Catalog
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
                <a href={`tel:${process.env.NEXT_PUBLIC_SHOP_PHONE?.replace(/[^+\d]/g,"") || "+12534496246"}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                  📞 Call Us
                </a>
              </div>

              {/* Trust bar */}
              <div className="mt-10 flex flex-wrap gap-6 border-t border-slate-100 pt-8">
                {[
                  { icon: "🏪", label: "Auburn, WA" },
                  { icon: "⚡", label: "Order Online" },
                  { icon: "🔧", label: `${items.length} Products` },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <span className="text-base">{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — featured slideshow */}
            <div className="relative lg:py-4">
              <FeaturedSlideshow items={featured} />
            </div>
          </div>
        </div>
      </section>

      <ProductRow title="Top Deals" subtitle="Limited-time savings" items={deals} accent="primary" />
      <ProductRow title="Just In" subtitle="New Arrivals" items={newArrivals} accent="gold" />

      {/* Catalog */}
      <section id="catalog" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Catalog</p>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {cats.length > 0 ? `${items.length} products across ${cats.length} categories` : "All Products"}
              </h2>
            </div>
            {/* Search */}
            <form action="/" method="get" className="w-full lg:w-auto">
              {cat && <input type="hidden" name="cat" value={cat} />}
              <label className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand-navy lg:w-[420px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input name="q" type="search" defaultValue={q || ""} placeholder="Search tools, brands, SKUs…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </label>
            </form>
          </div>

          {/* Category pills */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href="/" className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${!cat ? "bg-brand-navy text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              All
            </Link>
            {cats.map((c) => (
              <Link key={c.id} href={`/?cat=${encodeURIComponent(c.name)}`}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c.name ? "bg-brand-navy text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {c.name}
              </Link>
            ))}
          </div>

          {/* Grid */}
          <Suspense>
            <ShopGrid items={items} cat={cat} q={q} />
          </Suspense>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  );
}
