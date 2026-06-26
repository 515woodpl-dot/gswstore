import Link from "next/link";
import { getStoreItems, getStoreCategories } from "@/lib/inventory";
import ProductCard from "@/components/shop/ProductCard";

export const revalidate = 60;

export default async function HomePage() {
  let items: Awaited<ReturnType<typeof getStoreItems>> = [];
  let categories: Awaited<ReturnType<typeof getStoreCategories>> = [];

  try {
    [items, categories] = await Promise.all([getStoreItems(), getStoreCategories()]);
  } catch {
    // inventory API offline — show empty state
  }

  const featured = items.slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)", padding: "80px 0" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-7">
              <p className="text-primary fw-semibold mb-2" style={{ fontSize: "0.85rem", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                In-store pickup available
              </p>
              <h1 className="text-white mb-4" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.15 }}>
                The right tool for every job.
              </h1>
              <p className="mb-5" style={{ color: "rgba(255,255,255,0.65)", fontSize: "1.05rem", maxWidth: 500, lineHeight: 1.7 }}>
                Browse our full inventory online and place your order — we will have it ready for pickup at our store.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Link href="/shop" className="btn btn-primary" style={{ padding: "12px 32px" }}>Shop Now</Link>
                <Link href="/contact" className="btn btn-outline-light" style={{ padding: "12px 32px" }}>Contact Us</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories strip */}
      {categories.length > 0 && (
        <section style={{ background: "#f8f9fa", padding: "20px 0", borderBottom: "1px solid #e9ecef" }}>
          <div className="container">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className="text-muted me-2" style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Browse:</span>
              {categories.map((c) => (
                <Link key={c.id} href={`/shop?cat=${encodeURIComponent(c.name)}`}
                  className="btn btn-sm" style={{ borderColor: c.color, color: c.color, fontSize: "0.8rem" }}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      <section style={{ padding: "60px 0" }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-baseline mb-4">
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Featured Products</h2>
            <Link href="/shop" className="text-dark text-decoration-none" style={{ fontSize: "0.875rem" }}>View all &rarr;</Link>
          </div>
          {featured.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p>Products coming soon.</p>
              <Link href="/contact" className="btn btn-outline-dark btn-sm">Contact Us</Link>
            </div>
          ) : (
            <div className="row g-3">
              {featured.map((item) => <ProductCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
      </section>

      {/* Value props */}
      <section style={{ background: "#f8f9fa", padding: "48px 0", borderTop: "1px solid #e9ecef" }}>
        <div className="container">
          <div className="row g-4 text-center">
            {[
              { icon: "fa-store", title: "In-Store Pickup", desc: "Order online and pick up at our location — no shipping wait." },
              { icon: "fa-tools", title: "Quality Equipment", desc: "Every item in our inventory is vetted for quality and reliability." },
              { icon: "fa-headset", title: "Expert Support", desc: "Questions about a tool? Our team knows the product inside and out." },
            ].map((v) => (
              <div key={v.title} className="col-12 col-md-4">
                <i className={"fas " + v.icon + " mb-3"} style={{ fontSize: "2rem", color: "#0d6efd" }} />
                <h5 style={{ fontSize: "1rem", fontWeight: 600 }}>{v.title}</h5>
                <p className="text-muted" style={{ fontSize: "0.875rem" }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
