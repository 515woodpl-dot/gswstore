"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { itemCount } = useCart();
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/shop?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <>
      {/* Top bar */}
      <div className="notice-top-bar bg-primary" style={{ padding: "8px 0" }}>
        <div className="container">
          <p className="text-center text-white mb-0" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
            In-store pickup only — order online, collect at our location
          </p>
        </div>
      </div>

      <header id="header" className="header-effect-shrink" data-plugin-options="{'stickyEnabled': true, 'stickyEnableOnBoxed': true, 'stickyEnableOnMobile': false, 'stickyStartAt': 100, 'stickySetTop': '-100px', 'stickyChangeLogo': true}">
        <div className="header-body header-body-bottom-border-fixed box-shadow-none border-top-0">
          {/* Main header row */}
          <div className="header-container container">
            <div className="header-row py-2 d-flex align-items-center justify-content-between">

              {/* Logo */}
              <div className="header-logo">
                <Link href="/">
                  <span style={{ fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.5px", color: "#1a1a1a" }}>
                    GSW<span style={{ color: "#0d6efd" }}>.</span>
                  </span>
                </Link>
              </div>

              {/* Search */}
              <div className="d-none d-md-flex" style={{ flex: 1, maxWidth: 480, margin: "0 2rem" }}>
                <form onSubmit={handleSearch} className="w-100">
                  <div className="input-group">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Search products..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ borderRadius: "4px 0 0 4px", fontSize: "0.875rem" }}
                    />
                    <button className="btn btn-dark" type="submit" style={{ borderRadius: "0 4px 4px 0" }}>
                      <i className="fas fa-search" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Nav icons */}
              <div className="d-flex align-items-center gap-3">
                {user ? (
                  <div className="dropdown">
                    <button className="btn btn-link p-0 text-dark text-decoration-none" data-bs-toggle="dropdown">
                      <i className="fas fa-user" style={{ fontSize: "1.1rem" }} />
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li><Link className="dropdown-item" href="/account">My Account</Link></li>
                      <li><Link className="dropdown-item" href="/account/orders">My Orders</Link></li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <button className="dropdown-item text-danger" onClick={signOut}>
                          Sign Out
                        </button>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <Link href="/auth/login" className="text-dark text-decoration-none" title="Sign in">
                    <i className="fas fa-user" style={{ fontSize: "1.1rem" }} />
                  </Link>
                )}

                <Link href="/cart" className="position-relative text-dark text-decoration-none" title="Cart">
                  <i className="fas fa-shopping-cart" style={{ fontSize: "1.1rem" }} />
                  {itemCount > 0 && (
                    <span
                      className="position-absolute badge rounded-pill bg-primary"
                      style={{ top: "-8px", right: "-10px", fontSize: "0.6rem", padding: "2px 5px" }}
                    >
                      {itemCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* Nav links */}
            <div className="header-nav d-none d-md-flex" style={{ borderTop: "1px solid #e9ecef", paddingTop: "8px", paddingBottom: "8px" }}>
              <ul className="nav gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                <li><Link href="/" className="text-dark text-decoration-none fw-500" style={{ fontSize: "0.875rem" }}>Home</Link></li>
                <li><Link href="/shop" className="text-dark text-decoration-none fw-500" style={{ fontSize: "0.875rem" }}>Shop</Link></li>
                <li><Link href="/about" className="text-dark text-decoration-none fw-500" style={{ fontSize: "0.875rem" }}>About Us</Link></li>
                <li><Link href="/contact" className="text-dark text-decoration-none fw-500" style={{ fontSize: "0.875rem" }}>Contact</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
