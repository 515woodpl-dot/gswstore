import { notFound } from "next/navigation";
import Link from "next/link";
import { getStoreItem, getStoreCategories } from "@/lib/inventory";
import { formatPrice, stockLabel, stockColor } from "@/lib/utils";
import AddToCartButton from "@/components/shop/AddToCartButton";
import type { Metadata } from "next";

export const revalidate = 60;
interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try { const { id } = await params; const item = await getStoreItem(id); return { title: item.name }; }
  catch { return { title: "Product" }; }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  let item, categories;
  try {
    [item, categories] = await Promise.all([getStoreItem(id), getStoreCategories()]);
  } catch { notFound(); }

  const img = item!.image_url || "/img/products/product-grey-1.jpg";

  return (
    <div className="container py-4">
      {/* Breadcrumb — same as original */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link href="/">Shop</Link></li>
          {item!.category_name && (
            <li className="breadcrumb-item">
              <Link href={`/?cat=${encodeURIComponent(item!.category_name)}`}>{item!.category_name}</Link>
            </li>
          )}
          <li className="breadcrumb-item active">{item!.name}</li>
        </ol>
      </nav>

      <div className="row">
        {/* Left sidebar — categories */}
        <div className="col-lg-3 mb-4 mb-lg-0">
          <aside className="sidebar">
            <h5 className="font-weight-semi-bold pt-3">Categories</h5>
            <ul className="nav nav-list flex-column">
              {(categories ?? []).map(c => (
                <li className="nav-item" key={c.id}>
                  <Link className="nav-link" href={`/?cat=${encodeURIComponent(c.name)}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Link href="/" className="btn btn-outline-dark btn-sm w-100">&larr; Back to Shop</Link>
            </div>
          </aside>
        </div>

        {/* Product detail — same row structure as original */}
        <div className="col-lg-9">
          <div className="row" id="gsw-product-detail">

            {/* Image */}
            <div className="col-lg-5 mb-4 mb-lg-0">
              <div className="product-image-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} className="img-fluid rounded" alt={item!.name}
                  onError={undefined}
                  style={{ width: "100%", maxHeight: 420, objectFit: "contain", background: "#f8f9fa", padding: 16 }} />
              </div>
            </div>

            {/* Detail column */}
            <div className="col-lg-7">
              <div className="summary entry-summary">
                <h1 className="mb-0 font-weight-bold text-7">{item!.name}</h1>
                <div className="divider divider-small"><hr className="bg-color-grey-400" /></div>

                <p className="price mb-3">
                  <span className="sale text-color-dark text-7 font-weight-bold">{formatPrice(item!.store_price)}</span>
                </p>

                {item!.description && <p className="text-3-5 mb-3">{item!.description}</p>}

                <ul className="list list-unstyled text-2 mb-3">
                  <li className="mb-1">
                    AVAILABILITY:{" "}
                    <strong style={{ color: stockColor(item!.stock_status) }}>
                      {stockLabel(item!.stock_status, item!.amount)}
                    </strong>
                  </li>
                  {item!.sku && <li className="mb-1">SKU: <strong className="text-color-dark">{item!.sku}</strong></li>}
                  {item!.brand && <li className="mb-1">BRAND: <strong className="text-color-dark">{item!.brand}</strong></li>}
                  {item!.model_number && <li className="mb-1">MODEL: <strong className="text-color-dark">{item!.model_number}</strong></li>}
                  {item!.category_name && <li className="mb-1">CATEGORY: <strong className="text-color-dark">{item!.category_name}</strong></li>}
                </ul>

                <hr />
                <AddToCartButton item={item!} />
                <hr />

                <div className="p-3 rounded mt-3" style={{ background: "#f0f7ff", fontSize: "0.85rem" }}>
                  <i className="fas fa-store text-primary me-2" />
                  <strong>In-store pickup only.</strong> We will notify you when your order is ready for collection.
                </div>
              </div>
            </div>

            {/* Description tabs — same as original */}
            <div className="col-12 mt-5">
              <div id="description" className="tabs tabs-simple tabs-simple-full-width-line tabs-product tabs-dark mb-2">
                <ul className="nav nav-tabs justify-content-start">
                  <li className="nav-item">
                    <a className="nav-link active font-weight-bold text-3 text-uppercase py-2 px-3" href="#productDescription" data-bs-toggle="tab">Description</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link font-weight-bold text-3 text-uppercase py-2 px-3" href="#productInfo" data-bs-toggle="tab">Additional Information</a>
                  </li>
                </ul>
                <div className="tab-content p-0">
                  <div className="tab-pane px-0 py-3 active" id="productDescription">
                    {item!.description
                      ? <p>{item!.description}</p>
                      : <p className="text-muted">No description available.</p>}
                  </div>
                  <div className="tab-pane px-0 py-3" id="productInfo">
                    <table className="table table-striped m-0">
                      <tbody>
                        {item!.brand && <tr><th className="border-top-0">Brand</th><td className="border-top-0">{item!.brand}</td></tr>}
                        {item!.model_number && <tr><th>Model</th><td>{item!.model_number}</td></tr>}
                        {item!.category_name && <tr><th>Category</th><td>{item!.category_name}</td></tr>}
                        {item!.voltage && item!.voltage !== "N/A" && <tr><th>Voltage</th><td>{item!.voltage}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
