import { Suspense } from "react";
import { getStoreItems, getStoreCategories } from "@/lib/inventory";
import ShopGrid from "@/components/ShopGrid";
import { USING_MOCK_DATA } from "@/lib/inventory";

export const revalidate = 60;

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

export default async function HomePage({ searchParams }: Props) {
  const { q, cat } = await searchParams;
  const [items, cats] = await Promise.all([getStoreItems(), getStoreCategories()]);
  const usingMock = USING_MOCK_DATA;

  return (
    <div>
      {usingMock && (
        <div className="bg-amber-500 text-white text-center px-4 py-2 text-sm font-semibold">
          ⚠ Demo mode — set <code className="font-mono bg-amber-600 px-1 rounded">INVENTORY_API_BASE</code> to connect to your Pi inventory
        </div>
      )}
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8 lg:py-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-navy">
                The right tool for every job
              </p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Trade-grade tools and equipment built for the counter, the crew, and the next job.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Golden Stone Tools keeps the catalog sharp and the checkout simple. Buy online, then pick up in store when your order is ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#catalog" className="inline-flex items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Browse Products
              </a>
              <a href="/cart" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                View Cart
              </a>
            </div>
          </div>

          <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">Pickup only</p>
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/70">Fulfillment</p>
                <p className="mt-1 text-lg font-bold">Order online, collect in store.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/70">Catalog</p>
                <p className="mt-1 text-lg font-bold">{items.length} products across {cats.length} trade categories.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/70">Support</p>
                <p className="mt-1 text-lg font-bold">Straightforward tools, clear pricing, no fluff.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="scroll-mt-28 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Catalog</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Shop by category or search by product name.
              </h2>
            </div>
            {/* Search — client-side via form GET */}
            <form action="/" method="get">
              {cat && <input type="hidden" name="cat" value={cat} />}
              <label className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm lg:w-[420px]">
                <span className="text-sm font-semibold text-slate-500">Search</span>
                <input name="q" type="search" defaultValue={q || ""} placeholder="Drill, wrench, level, gloves..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </label>
            </form>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            <a href="/" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${!cat ? "bg-brand-navy text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              All Tools
            </a>
            {cats.map((c) => (
              <a key={c.id} href={`/?cat=${encodeURIComponent(c.name)}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c.name ? "bg-brand-navy text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {c.name}
              </a>
            ))}
          </div>

          {/* Grid */}
          <Suspense>
            <ShopGrid items={items} cat={cat} q={q} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
