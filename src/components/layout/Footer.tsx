import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer bg-color-dark text-color-light" style={{ padding: "48px 0 24px" }}>
      <div className="container">
        <div className="row g-4 mb-4">
          <div className="col-12 col-md-4">
            <h5 className="text-white fw-bold mb-3" style={{ fontSize: "1.1rem" }}>
              GSW<span style={{ color: "#0d6efd" }}>.</span>
            </h5>
            <p className="text-color-grey-400" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
              Quality tools and equipment for every job. In-store pickup only — order online, collect at our location.
            </p>
          </div>

          <div className="col-6 col-md-2">
            <h6 className="text-white mb-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shop</h6>
            <ul className="list-unstyled" style={{ fontSize: "0.875rem" }}>
              <li className="mb-1"><Link href="/shop" className="text-color-grey-400 text-decoration-none">All Products</Link></li>
              <li className="mb-1"><Link href="/cart" className="text-color-grey-400 text-decoration-none">Cart</Link></li>
              <li className="mb-1"><Link href="/account/orders" className="text-color-grey-400 text-decoration-none">My Orders</Link></li>
            </ul>
          </div>

          <div className="col-6 col-md-2">
            <h6 className="text-white mb-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Company</h6>
            <ul className="list-unstyled" style={{ fontSize: "0.875rem" }}>
              <li className="mb-1"><Link href="/about" className="text-color-grey-400 text-decoration-none">About Us</Link></li>
              <li className="mb-1"><Link href="/contact" className="text-color-grey-400 text-decoration-none">Contact</Link></li>
            </ul>
          </div>

          <div className="col-12 col-md-4">
            <h6 className="text-white mb-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</h6>
            <ul className="list-unstyled" style={{ fontSize: "0.875rem" }}>
              <li className="text-color-grey-400 mb-1">📍 Your address here</li>
              <li className="text-color-grey-400 mb-1">📞 (555) 000-0000</li>
              <li className="text-color-grey-400 mb-1">✉️ info@gswtools.com</li>
            </ul>
          </div>
        </div>

        <hr style={{ borderColor: "rgba(255,255,255,0.1)" }} />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <p className="text-color-grey-400 mb-0" style={{ fontSize: "0.8rem" }}>
            © {new Date().getFullYear()} GSW Tools. All rights reserved.
          </p>
          <p className="text-color-grey-400 mb-0" style={{ fontSize: "0.8rem" }}>
            In-store pickup only
          </p>
        </div>
      </div>
    </footer>
  );
}
