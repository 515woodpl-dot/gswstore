import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getStoreItem, getStoreItems, getItemReviews } from "@/lib/inventory";
import { formatPrice, stockLabel, stockColor, priceBreakdown } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
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
  try {
    const { id } = await params;
    const item = await getStoreItem(id);
    const description = item.description || `Shop ${item.name} for local pickup from ${BRAND.name}.`;
    const image = item.image_url || item.images?.[0];
    const imageUrl = image ? (image.startsWith("http") ? image : new URL(image, BRAND.siteUrl).toString()) : undefined;
    return {
      title: item.name,
      description,
      openGraph: { title: item.name, description, images: imageUrl ? [imageUrl] : [] },
      twitter: { card: "summary_large_image", title: item.name, description, images: imageUrl ? [imageUrl] : [] },
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  let item, allItems, reviews;
  try {
    [item, allItems, reviews] = await Promise.all([getStoreItem(id), getStoreItems(), getItemReviews(id)]);
  } catch {
    notFound();
  }

  const reviewCount = reviews!.length;
  const reviewAvg = reviewCount ? reviews!.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0;
  const price = priceBreakdown({
    store_price: item!.store_price,
    sale_price: item!.sale_price,
    tax_enabled: item!.tax_enabled,
    tax_rate_percent: item!.tax_rate_percent,
  });
  const related = allItems!.filter((candidate) => candidate.category_name === item!.category_name && candidate.id !== item!.id).slice(0, 3);
  const galleryImages = item!.images?.length ? item!.images : (item!.image_url ? [item!.image_url] : []);
  const placeholder = "/proposal/stone-shop-still-life.png";

  const sections = [
    {
      title: "Product guidance",
      content: item!.description ? <p>{item!.description}</p> : <p className="text-slate-400">Ask our counter team for product guidance.</p>,
    },
    {
      title: "Specifications",
      content: (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {item!.brand && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Brand</dt><dd className="mt-1 font-bold text-brand-navy">{item!.brand}</dd></div>}
          {item!.model_number && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Model</dt><dd className="mt-1 font-bold text-brand-navy">{item!.model_number}</dd></div>}
          {item!.voltage && item!.voltage !== "N/A" && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Voltage</dt><dd className="mt-1 font-bold text-brand-navy">{item!.voltage}</dd></div>}
          {item!.dimensions && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dimensions</dt><dd className="mt-1 font-bold text-brand-navy">{item!.dimensions}</dd></div>}
          {item!.weight && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Weight</dt><dd className="mt-1 font-bold text-brand-navy">{item!.weight}</dd></div>}
          {item!.material && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Material</dt><dd className="mt-1 font-bold text-brand-navy">{item!.material}</dd></div>}
          {item!.sku && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">SKU</dt><dd className="mt-1 font-bold text-brand-navy">{item!.sku}</dd></div>}
          {item!.category_name && <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Category</dt><dd className="mt-1 font-bold text-brand-navy">{item!.category_name}</dd></div>}
        </dl>
      ),
    },
    {
      title: "Pickup & returns",
      content: (
        <div className="space-y-2">
          <p>In-store pickup only. We prepare your order for collection at the Auburn counter.</p>
          <p className="font-bold" style={{ color: stockColor(item!.stock_status) }}>{stockLabel(item!.stock_status, item!.amount)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#fbfaf7]">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-hidden px-4 py-5 text-[10px] font-bold text-slate-400 sm:px-6 lg:px-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-gold">Home</Link><span>/</span>
        <Link href={item!.category_name ? `/shop?cat=${encodeURIComponent(item!.category_name)}` : "/shop"} className="hover:text-brand-gold">{item!.category_name || "Shop"}</Link><span>/</span>
        <span className="truncate text-brand-navy">{item!.name}</span>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-8 lg:pb-24">
        <ImageGallery images={galleryImages} name={item!.name} />

        <div className="pt-1">
          <div className="flex items-center justify-between gap-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue">{item!.brand || "Stone Product Supply"}</p>
            {item!.sku && <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">SKU {item!.sku}</p>}
          </div>
          {item!.category_name?.toLowerCase() === "sink" && item!.dimensions && <p className="mt-4 text-xs font-bold tracking-[0.12em] text-brand-blue">Sink dimensions: {item!.dimensions}</p>}
          <h1 className="font-display mt-4 text-[clamp(3.25rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-brand-navy">{item!.name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-300 pb-5 text-xs">
            <StockBadge status={item!.stock_status} />
            {reviewCount > 0 && <a href="#reviews" className="flex items-center gap-2 text-slate-500 hover:text-brand-gold"><Stars value={reviewAvg} /><b>{reviewAvg.toFixed(1)}</b><span>({reviewCount})</span></a>}
          </div>

          {item!.description && <p className="mt-6 text-sm leading-7 text-slate-600">{item!.description}</p>}

          {item!.variants?.length ? (
            <div className="mt-7"><VariantSelector product={item!} /></div>
          ) : (
            <div className="mt-7 border-y border-slate-300 py-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Counter price</p>
                  {item!.sale_price ? (
                    <div className="mt-1 flex items-baseline gap-3"><p className="font-display text-4xl font-black text-brand-gold">{formatPrice(item!.sale_price)}</p><p className="text-base font-bold text-slate-400 line-through">{formatPrice(item!.store_price)}</p></div>
                  ) : <p className="font-display mt-1 text-4xl font-black text-brand-navy">{formatPrice(item!.store_price)}</p>}
                  {price.taxed && <p className="mt-1 text-[10px] text-slate-500">{formatPrice(price.total)} with {price.taxRate}% tax</p>}
                </div>
                {item!.sale_price && <span className="bg-orange-100 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-brand-gold">On sale</span>}
              </div>
              <AddToCartButton item={item!} />
            </div>
          )}

          <div className="mt-6 border-l-[3px] border-emerald-600 bg-emerald-50 p-4">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white">✓</span><p className="text-[10px] text-emerald-800"><b className="block text-xs">{item!.amount > 0 ? "Ready for pickup" : "Check availability"}</b>{stockLabel(item!.stock_status, item!.amount)} at Auburn</p></div>
          </div>
          <ul className="mt-5 grid gap-2 text-[10px] text-slate-500">
            <li>↗ Order before 2 PM for same-day pickup</li>
            <li>↺ Unopened items returnable within 30 days</li>
            <li>? Product question? Call {BRAND.phone}</li>
          </ul>
        </div>
      </section>

      <section className="bg-[#dfe8ed] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 lg:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Product information</p>
            <h2 className="font-display mt-3 text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-brand-navy sm:text-6xl">Know the details before the job.</h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-slate-600">Review compatibility, specifications, and pickup information before ordering. Need a second opinion? Our counter team can help.</p>
          </div>
          <Accordion sections={sections} defaultOpen={0} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <KeyAttributes attributes={item!.attributes} />
        <div id="reviews"><ProductReviews itemId={item!.id} initialReviews={reviews!} /></div>

        {related.length > 0 && (
          <section className="mt-20 border-t border-slate-300 pt-12">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Keep the job moving</p>
            <h2 className="font-display mt-2 text-4xl font-black uppercase tracking-[-0.05em] text-brand-navy">More in {item!.category_name}</h2>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedItem) => (
                <article key={relatedItem.id} className="group overflow-hidden border border-slate-300 bg-white">
                  <Link href={`/shop/product/${relatedItem.id}`} className="block overflow-hidden bg-[#e5e1da]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={relatedItem.image_url || relatedItem.images?.[0] || placeholder} alt={relatedItem.name} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  </Link>
                  <div className="p-5"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-blue">{relatedItem.category_name}</p><h3 className="font-display mt-2 text-lg font-black uppercase text-brand-navy">{relatedItem.name}</h3><p className="mt-3 font-display text-xl font-black text-brand-gold">{formatPrice(relatedItem.sale_price ?? relatedItem.store_price)}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="bg-brand-blue text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.9fr_auto] lg:px-8">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">Not sure it fits your setup?</p><h2 className="font-display mt-3 text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em]">Ask someone who knows the work.</h2></div>
          <p className="text-xs leading-6 text-white/65">We’ll confirm material compatibility, sizing, and the right consumables before you order.</p>
          <a href={`tel:${BRAND.phoneRaw}`} className="bg-[#f4efe7] px-5 py-4 text-xs font-black uppercase tracking-wide text-brand-navy">Call the counter →</a>
        </div>
      </section>
    </div>
  );
}
