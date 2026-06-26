import { Suspense } from "react";
import { getStoreItems, getStoreCategories } from "@/lib/inventory";
import ProductCard from "@/components/shop/ProductCard";
import CategoryFilter from "@/components/shop/CategoryFilter";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shop" };
export const revalidate = 60;

interface Props {
  searchParams: Promise<{ cat?: string; q?: string }>;
}

export default async function ShopPage({ searchParams }: Props) {
  const { cat, q } = await searchParams;

  let items: Awaited<ReturnType<typeof getStoreItems>> = [];
  let categories: Awaited<ReturnType<typeof getStoreCategories>> = [];

  try {
    [items, categories] = await Promise.all([getStoreItems(), getStoreCategories()]);
  } catch {
    // inventory offline
  }

  // Filter
  let filtered = items;
  if (cat) filtered = filtered.filter((i) => i.category_name === cat);
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.name.toLowerCase().includes(ql) ||
        (i.brand || "").toLowerCase().includes(ql) ||
        (i.sku || "").toLowerCase().includes(ql) ||
        (i.description || "").toLowerCase().includes(ql)
    );
  }

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container">
        {/* Page header */}
        <div className="mb-4">
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
            {cat ? cat : q ? `Search: "${q}"` : "All Products"}
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
            {cat ? ` in ${cat}` : ""}
            {q ? ` matching "${q}"` : ""}
          </p>
        </div>

        {/* Category filter */}
        <Suspense>
          <CategoryFilter categories={categories} active={cat || "all"} />
        </Suspense>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted mb-3">
              {items.length === 0
                ? "Unable to load products. The inventory server may be offline."
                : "No products match your search."}
            </p>
            {q || cat ? (
              <a href="/shop" className="btn btn-outline-dark btn-sm">Clear filters</a>
            ) : null}
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
