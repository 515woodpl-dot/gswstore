import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getStoreItem, getStoreItems, getItemReviews } from "@/lib/inventory";
import { formatPrice, stockLabel, stockColor, priceBreakdown } from "@/lib/utils";
import AddToCartButton from "@/components/AddToCartButton";
import VariantSelector from "@/components/VariantSelector";
import ImageGallery from "@/components/ImageGallery";
import Accordion from "@/components/Accordion";
import KeyAttributes from "@/components/KeyAttributes";
import ProductReviews from "@/components/ProductReviews";
import { Stars } from "@/components/Stars";
import { StockBadge } from "@/components/ui";

export const revalidate = 60;
interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try { const { id } = await params; const item = await getStoreItem(id); return { title: item.name }; }
  catch { return { title: "Product" }; }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  let item, allItems, reviews;
  try { [item, allItems, reviews] = await Promise.all([getStoreItem(id), getStoreItems(), getItemReviews(id)]); }
  catch { notFound(); }

  const reviewCount = reviews!.length;
  const reviewAvg = reviewCount ? reviews!.reduce((a, r) => a + r.rating, 0) / reviewCount : 0;

  // Tax breakdown (controlled per-item from the inventory admin panel)
  const price = priceBreakdown({
    store_price: item!.store_price,
    sale_price: item!.sale_price,
    tax_enabled: item!.tax_enabled,
    tax_rate_percent: item!.tax_rate_percent,
  });

  const related = allItems!.filter((i) => i!.category_name === item!.category_name && i.id !== item!.id).slice(0, 3);

  // Build gallery: explicit images, falling back to the single image_url
  const galleryImages = (item!.images && item!.images.length > 0)
    ? item!.images
    : (item!.image_url ? [item!.image_url] : []);

  const PLACEHOLDER = "https://placehold.co/720x540/1e3a5f/ffffff?text=Golden+Stone+Tools";

  // Accordion sections
  const sections = [
    {
      title: "Description",
      content: item!.description
        ? <p>{item!.description}</p>
        : <p className="text-slate-400">No description provided.</p>,
    },
    {
      title: "Specifications",
      content: (
        <dl className="grid gap-3 sm:grid-cols-2">
          {item!.brand && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</dt><dd className="mt-0.5 font-semibold text-slate-900">{item!.brand}</dd></div>}
          {item!.model_number && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model</dt><dd className="mt-0.5 font-semibold text-slate-900">{item!.model_number}</dd></div>}
          {item!.voltage && item!.voltage !== "N/A" && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Voltage</dt><dd className="mt-0.5 font-semibold text-slate-900">{item!.voltage}</dd></div>}
          {item!.sku && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</dt><dd className="mt-0.5 font-semibold text-slate-900">{item!.sku}</dd></div>}
          {item!.category_name && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</dt><dd className="mt-0.5 font-semibold text-slate-900">{item!.category_name}</dd></div>}
        </dl>
      ),
    },
    {
      title: "Pickup & Availability",
      content: (
        <div className="space-y-2">
          <p>In-store pickup only. Orders are prepared for collection at the store counter — no delivery or shipping.</p>
          <p className="font-semibold" style={{ color: stockColor(item!.stock_status) }}>
            {stockLabel(item!.stock_status, item!.amount)}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">← Back to catalog</Link>
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item!.category_name}</span>
      </div>

      <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* LEFT — image gallery */}
        <ImageGallery images={galleryImages} name={item!.name} />

        {/* RIGHT — details */}
        <div className="space-y-5 sm:space-y-6">
          <div className="space-y-3">
            {item!.sku && <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{item!.sku}</p>}
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{item!.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StockBadge status={item!.stock_status} />
              <span className="text-sm text-slate-500">In-store pickup</span>
            </div>
            {reviewCount > 0 && (
              <a href="#reviews" className="flex w-fit items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <Stars value={reviewAvg} />
                <span className="font-semibold">{reviewAvg.toFixed(1)}</span>
                <span className="text-slate-400">({reviewCount} review{reviewCount === 1 ? "" : "s"})</span>
              </a>
            )}
          </div>

          {/* Price + quantity + add to cart (or variant selector) */}
          {item!.variants && item!.variants.length > 0 ? (
            <VariantSelector product={item!} />
          ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Price</p>
                {item!.sale_price ? (
                <div className="mt-1 flex items-baseline gap-3">
                  <p className="text-3xl font-black tracking-tight text-brand-primary sm:text-4xl">{formatPrice(item!.sale_price)}</p>
                  <p className="text-xl font-semibold text-slate-400 line-through">{formatPrice(item!.store_price)}</p>
                  <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-bold uppercase text-white">On Sale</span>
                </div>
              ) : (
                <p className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{formatPrice(item!.store_price)}</p>
              )}
                {price.taxed ? (
                  <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                    <p>+ {price.taxRate}% tax ({formatPrice(price.taxAmount)})</p>
                    <p className="font-semibold text-slate-900">Total with tax: {formatPrice(price.total)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Tax included / not applicable</p>
                )}
              </div>
            </div>
            <AddToCartButton item={item!} />
          </div>
          )}

          {/* Accordion: description / specs / pickup */}
          <Accordion sections={sections} defaultOpen={0} />
        </div>
      </section>

      {/* Key attributes — populated from inventory */}
      <KeyAttributes attributes={item!.attributes} />

      {/* Customer reviews */}
      <div id="reviews">
        <ProductReviews itemId={item!.id} initialReviews={reviews!} />
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Related items</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">More in {item!.category_name}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-5">
            {related.map((r) => (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Link href={`/shop/product/${r.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image_url || r.images?.[0] || PLACEHOLDER} alt={r.name} className="aspect-[4/3] w-full object-cover" />
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
