import { Suspense } from "react";
import { getStoreItems, getStoreCategories } from "@/lib/inventory";
import ShopGrid from "@/components/shop/ShopGrid";

export const revalidate = 60;

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

export default async function HomePage({ searchParams }: Props) {
  const { q, cat } = await searchParams;
  const [items, categories] = await Promise.all([getStoreItems(), getStoreCategories()]);

  return (
    <div className="container">
      {/* Category filter bar — exact same as original gsw-category-filter */}
      <div className="mb-3 pb-2" style={{ minHeight: 38 }}>
        <div className="d-flex flex-wrap gap-2">
          <Suspense>
            <a href="/" className={`btn btn-sm ${!cat ? "btn-dark" : "btn-outline-dark"}`}>All</a>
            {categories.map(c => (
              <a key={c.id} href={`/?cat=${encodeURIComponent(c.name)}`}
                className="btn btn-sm"
                style={{
                  background: cat === c.name ? c.color : "transparent",
                  color: cat === c.name ? "#fff" : c.color,
                  borderColor: c.color,
                }}>
                {c.name}
              </a>
            ))}
          </Suspense>
        </div>
      </div>

      {/* Mobile search */}
      <div className="mb-3 d-lg-none">
        <form action="/" method="get">
          <input type="search" name="q" className="form-control text-1"
            placeholder="Search products…" defaultValue={q || ""} />
        </form>
      </div>

      {/* Product grid — exact Porto classes from original */}
      <div className="masonry-loader masonry-loader-showing">
        <div className="row products product-thumb-info-list" id="gsw-products-grid">
          <ShopGrid items={items} cat={cat} q={q} />
        </div>
      </div>
    </div>
  );
}
