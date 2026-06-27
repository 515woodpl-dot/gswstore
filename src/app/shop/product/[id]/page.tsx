import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getStoreItem, getStoreItems } from "@/lib/inventory";
import { formatPrice, stockLabel, stockColor } from "@/lib/utils";
import AddToCartButton from "@/components/AddToCartButton";
import { StockBadge } from "@/components/ui";

export const revalidate = 60;
interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try { const { id } = await params; const item = await getStoreItem(id); return { title: item.name }; }
  catch { return { title: "Product" }; }
}

const PLACEHOLDER = "https://placehold.co/720x540/1e3a5f/ffffff?text=Golden+Stone+Tools";

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  let item, allItems;
  try { [item, allItems] = await Promise.all([getStoreItem(id), getStoreItems()]); }
  catch { notFound(); }

  const related = allItems!.filter((i) => i!.category_name === item!.category_name && i.id !== item!.id).slice(0, 3);
  const img = item!.image_url || PLACEHOLDER;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
          ← Back to catalog
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item!.category_name}</span>
      </div>

      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Image */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={item!.name} className="h-full w-full object-cover" />
        </div>

        {/* Detail */}
        <div className="space-y-6">
          <div className="space-y-3">
            {item!.sku && <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{item!.sku}</p>}
            <h1 className="text-4xl font-black tracking-tight text-slate-950">{item!.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StockBadge status={item!.stock_status} />
              <span className="text-sm text-slate-500">In-store pickup only</span>
            </div>
          </div>

          {item!.description && <p className="text-lg leading-8 text-slate-600">{item!.description}</p>}

          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-semibold">In-store pickup only</p>
            <p className="mt-1">Orders are prepared for pickup at the store counter. No delivery or shipping.</p>
          </div>

          <div className="flex items-end justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Price</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-950">{formatPrice(item!.store_price)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Available</p>
              <p className="text-lg font-bold text-slate-950">{item!.amount}</p>
            </div>
          </div>

          <AddToCartButton item={item!} />

          {/* Specs */}
          {(item!.brand || item!.model_number || item!.voltage) && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Product Specs</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {item!.brand && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Brand</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">{item!.brand}</dd>
                  </div>
                )}
                {item!.model_number && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Model</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">{item!.model_number}</dd>
                  </div>
                )}
                {item!.voltage && item!.voltage !== "N/A" && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Voltage</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">{item!.voltage}</dd>
                  </div>
                )}
                {item!.category_name && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Category</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">{item!.category_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Related items</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">More in {item!.category_name}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((r) => (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Link href={`/shop/product/${r.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image_url || PLACEHOLDER} alt={r.name} className="aspect-[4/3] w-full object-cover" />
                </Link>
                <div className="space-y-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{r.category_name}</p>
                  <h3 className="text-lg font-bold text-slate-950">{r.name}</h3>
                  <p className="text-sm text-slate-600">{formatPrice(r.store_price)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
