import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getStoreItem } from "@/lib/inventory";
import { formatPrice, stockLabel, stockColor } from "@/lib/format";
import AddToCartButton from "@/components/shop/AddToCartButton";
import type { Metadata } from "next";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const item = await getStoreItem(id);
    return { title: item.name, description: item.description || undefined };
  } catch {
    return { title: "Product not found" };
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  let item;
  try {
    item = await getStoreItem(id);
  } catch {
    notFound();
  }

  const img = item.image_url || null;

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container">
        {/* Breadcrumb */}
        <nav className="mb-4" style={{ fontSize: "0.8rem" }}>
          <Link href="/" className="text-muted text-decoration-none">Home</Link>
          <span className="text-muted mx-2">/</span>
          <Link href="/shop" className="text-muted text-decoration-none">Shop</Link>
          {item.category_name && (
            <>
              <span className="text-muted mx-2">/</span>
              <Link href={`/shop?cat=${encodeURIComponent(item.category_name)}`} className="text-muted text-decoration-none">
                {item.category_name}
              </Link>
            </>
          )}
          <span className="text-muted mx-2">/</span>
          <span className="text-dark">{item.name}</span>
        </nav>

        <div className="row g-5">
          {/* Image */}
          <div className="col-lg-5">
            <div style={{ position: "relative", aspectRatio: "1", background: "#f8f9fa", borderRadius: 8, overflow: "hidden" }}>
              {img ? (
                <Image
                  src={img}
                  alt={item.name}
                  fill
                  sizes="(max-width: 992px) 100vw, 50vw"
                  style={{ objectFit: "contain", padding: "24px" }}
                  priority
                />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  <i className="fas fa-image" style={{ fontSize: "3rem", opacity: 0.3 }} />
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="col-lg-7">
            {item.category_name && (
              <Link
                href={`/shop?cat=${encodeURIComponent(item.category_name)}`}
                className="text-decoration-none text-uppercase d-inline-block mb-2"
                style={{ fontSize: "0.75rem", letterSpacing: "0.1em", color: "#6c757d" }}
              >
                {item.category_name}
              </Link>
            )}

            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.25, marginBottom: "12px" }}>
              {item.name}
            </h1>

            <div style={{ height: 1, background: "#e9ecef", margin: "16px 0" }} />

            <p style={{ fontSize: "2rem", fontWeight: 800, color: "#1a1a1a", marginBottom: "8px" }}>
              {formatPrice(item.store_price)}
            </p>

            {/* Stock status */}
            <p className="mb-3" style={{ fontSize: "0.875rem", color: stockColor(item.stock_status), fontWeight: 500 }}>
              {stockLabel(item.stock_status, item.amount)}
            </p>

            {item.description && (
              <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#444", marginBottom: "20px" }}>
                {item.description}
              </p>
            )}

            {/* Quick specs */}
            <ul className="list-unstyled mb-4" style={{ fontSize: "0.875rem" }}>
              {item.sku && <li className="mb-1"><span className="text-muted">SKU:</span> <strong>{item.sku}</strong></li>}
              {item.brand && <li className="mb-1"><span className="text-muted">Brand:</span> <strong>{item.brand}</strong></li>}
              {item.model_number && <li className="mb-1"><span className="text-muted">Model:</span> <strong>{item.model_number}</strong></li>}
              {item.voltage && item.voltage !== "N/A" && (
                <li className="mb-1"><span className="text-muted">Voltage:</span> <strong>{item.voltage}</strong></li>
              )}
            </ul>

            <div style={{ height: 1, background: "#e9ecef", margin: "16px 0" }} />

            {/* Add to cart */}
            <AddToCartButton item={item} />

            <div style={{ height: 1, background: "#e9ecef", margin: "20px 0" }} />

            {/* Pickup note */}
            <div className="d-flex align-items-start gap-2 p-3 rounded" style={{ background: "#f0f7ff", fontSize: "0.85rem" }}>
              <i className="fas fa-store text-primary mt-1" />
              <div>
                <strong>In-store pickup only</strong>
                <p className="mb-0 text-muted">Once you place your order, we will notify you when it is ready for collection.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional info tabs */}
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid #e9ecef" }}>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button className="nav-link active" style={{ fontSize: "0.875rem", fontWeight: 600 }}>Description</button>
            </li>
            <li className="nav-item">
              <button className="nav-link" style={{ fontSize: "0.875rem" }}>Specifications</button>
            </li>
          </ul>

          {item.description ? (
            <p style={{ maxWidth: 700, lineHeight: 1.8, color: "#444" }}>{item.description}</p>
          ) : (
            <p className="text-muted">No description available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
