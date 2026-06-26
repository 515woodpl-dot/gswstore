"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { formatPrice, stockColor } from "@/lib/format";
import type { InventoryItem } from "@/types";
import { useState } from "react";

const PLACEHOLDER = "/img/product-placeholder.jpg";

interface Props {
  item: InventoryItem;
}

export default function ProductCard({ item }: Props) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const isOutOfStock = item.stock_status === "out_of_stock";

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/auth/login?next=/shop`);
      return;
    }

    if (isOutOfStock) return;

    setAdding(true);
    try {
      await addItem(item);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      // silently fail — user sees no change
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="col-6 col-lg-3">
      <div className="product mb-4">
        {/* Image */}
        <div className="product-thumb-info border-0 mb-3" style={{ position: "relative" }}>
          {/* Stock badge */}
          {item.stock_status === "out_of_stock" && (
            <div className="product-thumb-info-badges-wrapper">
              <span className="badge text-bg-danger" style={{ fontSize: "0.65rem", padding: "3px 7px" }}>OUT OF STOCK</span>
            </div>
          )}
          {item.stock_status === "low_stock" && (
            <div className="product-thumb-info-badges-wrapper">
              <span className="badge" style={{ fontSize: "0.65rem", padding: "3px 7px", background: "#f59e0b", color: "#fff" }}>LOW STOCK</span>
            </div>
          )}

          <Link href={`/shop/product/${item.id}`} style={{ display: "block" }}>
            <div className="product-thumb-info-image" style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "#f8f9fa" }}>
              <Image
                src={item.image_url || PLACEHOLDER}
                alt={item.name}
                fill
                sizes="(max-width: 576px) 50vw, (max-width: 992px) 33vw, 25vw"
                style={{ objectFit: "contain", padding: "8px" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER;
                }}
              />
            </div>
          </Link>
        </div>

        {/* Info */}
        <div>
          {item.category_name && (
            <Link
              href={`/shop?cat=${encodeURIComponent(item.category_name)}`}
              className="d-block text-uppercase text-decoration-none line-height-1 mb-1"
              style={{ fontSize: "0.7rem", color: "#6c757d", letterSpacing: "0.05em" }}
            >
              {item.category_name}
            </Link>
          )}
          <h3 style={{ fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.3, marginBottom: "4px" }}>
            <Link href={`/shop/product/${item.id}`} className="text-dark text-decoration-none">
              {item.name}
            </Link>
          </h3>

          <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
            <p className="price mb-0" style={{ fontSize: "1rem", fontWeight: 700, color: "#1a1a1a" }}>
              {formatPrice(item.store_price)}
            </p>

            <button
              className="btn btn-dark btn-sm"
              onClick={handleAddToCart}
              disabled={adding || isOutOfStock}
              style={{ fontSize: "0.7rem", padding: "4px 10px", minWidth: 80 }}
            >
              {adding ? "Adding…" : added ? "✓ Added" : isOutOfStock ? "Unavailable" : "Add to Cart"}
            </button>
          </div>

          {item.stock_status !== "in_stock" && (
            <p className="mt-1 mb-0" style={{ fontSize: "0.7rem", color: stockColor(item.stock_status) }}>
              {item.stock_status === "out_of_stock" ? "Out of stock" : `Only ${item.amount} left`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
