"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const PLACEHOLDER = "/img/products/product-grey-1.jpg";

function ProductCard({ item }: { item: InventoryItem }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const isOut = item.stock_status === "out_of_stock";

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push("/auth/login?next=/"); return; }
    if (isOut) return;
    setAdding(true);
    try { await addItem(item); setAdded(true); setTimeout(() => setAdded(false), 2000); }
    finally { setAdding(false); }
  }

  const img = item.image_url || PLACEHOLDER;
  const detailUrl = `/shop/product/${item.id}`;

  return (
    <div className="col-12 col-sm-6 col-lg-3">
      <div className="product mb-0">
        <div className="product-thumb-info border-0 mb-3">
          {item.stock_status === "out_of_stock" && (
            <div className="product-thumb-info-badges-wrapper">
              <span className="badge badge-ecommerce text-bg-danger">OUT OF STOCK</span>
            </div>
          )}
          {item.stock_status === "low_stock" && (
            <div className="product-thumb-info-badges-wrapper">
              <span className="badge badge-ecommerce" style={{ background: "#f59e0b" }}>LOW STOCK</span>
            </div>
          )}
          <Link href={detailUrl}>
            <div className="product-thumb-info-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={item.name} className="img-fluid" src={img}
                onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
            </div>
          </Link>
        </div>

        <div className="d-flex justify-content-between">
          <div>
            {item.category_name && (
              <Link href={`/?cat=${encodeURIComponent(item.category_name)}`}
                className="d-block text-uppercase text-decoration-none text-color-default text-color-hover-primary line-height-1 text-0 mb-1">
                {item.category_name}
              </Link>
            )}
            <h3 className="text-3-5 font-weight-medium font-alternative text-transform-none line-height-3 mb-0">
              <Link href={detailUrl} className="text-color-dark text-color-hover-primary">{item.name}</Link>
            </h3>
          </div>
        </div>

        <p className="price text-5 mb-2 mt-1">
          <span className="sale text-color-dark font-weight-semi-bold">{formatPrice(item.store_price)}</span>
        </p>

        <button
          className={`btn btn-sm w-100 ${isOut ? "btn-outline-secondary" : added ? "btn-success" : "btn-dark"}`}
          onClick={handleAdd}
          disabled={adding || isOut}
          style={{ fontSize: "0.75rem" }}
        >
          {adding ? "Adding…" : added ? "✓ Added to Cart" : isOut ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  items: InventoryItem[];
  cat?: string;
  q?: string;
}

export default function ShopGrid({ items, cat, q }: Props) {
  let filtered = items;
  if (cat) filtered = filtered.filter(i => i.category_name === cat);
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(ql) ||
      (i.brand || "").toLowerCase().includes(ql) ||
      (i.sku || "").toLowerCase().includes(ql) ||
      (i.description || "").toLowerCase().includes(ql)
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="col-12 text-center py-5">
        <p className="text-muted">
          {items.length === 0 ? "No products are currently available." : "No products match your search."}
        </p>
        {(cat || q) && <a href="/" className="btn btn-sm btn-outline-dark">Clear filters</a>}
      </div>
    );
  }

  return <>{filtered.map(item => <ProductCard key={item.id} item={item} />)}</>;
}
