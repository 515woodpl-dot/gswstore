"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

export default function PortoShell({ children }: { children: ReactNode }) {
  const { itemCount, cart } = useCart();
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/?q=${encodeURIComponent(search.trim())}`);
  }

  const cartItems = cart?.items ?? [];

  return (
    <>
      {/* ── TOP NOTICE BAR ─────────────────────────────────────────────────── */}
      <div className="notice-top-bar bg-primary" data-sticky-start-at="180">
        <button className="hamburguer-btn hamburguer-btn-light notice-top-bar-close m-0 active" data-set-active="false">
          <span className="close"><span /><span /></span>
        </button>
        <div className="container">
          <div className="row justify-content-center py-2">
            <div className="col-9 col-md-12 text-center">
              <p className="text-color-light font-weight-semibold mb-0">
                In-store pickup only — order online, collect at our location
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header id="header" data-plugin-options="{'stickyEnabled': true, 'stickyEnableOnBoxed': true, 'stickyEnableOnMobile': false, 'stickyStartAt': 135, 'stickySetTop': '-135px', 'stickyChangeLogo': true}">
        <div className="header-body header-body-bottom-border-fixed box-shadow-none border-top-0">

          {/* Top strip */}
          <div className="header-top header-top-small-minheight header-top-simple-border-bottom">
            <div className="container">
              <div className="header-row justify-content-between">
                <div className="header-column col-auto px-0">
                  <div className="header-row">
                    <p className="font-weight-semibold text-1 mb-0 d-none d-sm-block d-md-none">IN-STORE PICKUP ONLY</p>
                    <p className="font-weight-semibold text-1 mb-0 d-none d-md-block">IN-STORE PICKUP ONLY — ORDER ONLINE, COLLECT AT OUR LOCATION</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main header row */}
          <div className="header-container container">
            <div className="header-row py-2">
              <div className="header-column w-100">
                <div className="header-row justify-content-between">

                  {/* Logo */}
                  <div className="header-logo z-index-2 col-lg-2 px-0">
                    <Link href="/">
                      <img alt="Golden Stone Tools" width="100" height="48"
                        data-sticky-width="82" data-sticky-height="40" data-sticky-top="84"
                        src="/img/logo-default-slim.png" />
                    </Link>
                  </div>

                  {/* Search */}
                  <div className="header-nav-features header-nav-features-no-border p-relative z-index-2 col col-lg-5 col-xl-6 px-0 ms-0">
                    <div className="header-nav-feature ps-lg-5 pe-2 pe-lg-4 me-4 me-lg-0">
                      <form onSubmit={handleSearch}>
                        <div className="search-with-select">
                          <a href="#" className="mobile-search-toggle-btn text-decoration-none" data-toggle-class="open">
                            <i className="icons icon-magnifier text-color-dark text-color-hover-primary" />
                          </a>
                          <div className="search-form-wrapper input-group">
                            <input className="form-control text-1" type="search" placeholder="Search products..."
                              value={search} onChange={e => setSearch(e.target.value)} />
                            <button className="btn" type="submit" aria-label="Search">
                              <i className="icons icon-magnifier header-nav-top-icon text-color-dark" />
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* Right icons */}
                  <div className="d-flex col-auto col-lg-2 pe-0 ps-0 ps-xl-3">
                    <ul className="header-extra-info">
                      {/* User icon */}
                      <li className="ms-0 ms-xl-4">
                        <div className="header-extra-info-icon">
                          {user ? (
                            <div className="dropdown">
                              <a href="#" className="text-decoration-none text-color-dark text-color-hover-primary text-2" data-bs-toggle="dropdown">
                                <i className="icons icon-user" />
                              </a>
                              <ul className="dropdown-menu dropdown-menu-end">
                                <li><Link className="dropdown-item" href="/account">My Account</Link></li>
                                <li><Link className="dropdown-item" href="/account/orders">My Orders</Link></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><button className="dropdown-item text-danger" onClick={signOut}>Sign Out</button></li>
                              </ul>
                            </div>
                          ) : (
                            <Link href="/auth/login" className="text-decoration-none text-color-dark text-color-hover-primary text-2">
                              <i className="icons icon-user" />
                            </Link>
                          )}
                        </div>
                      </li>
                    </ul>

                    {/* Cart */}
                    <div className="header-nav-features ps-0 ms-1">
                      <div className="header-nav-feature header-nav-features-cart header-nav-features-cart-big d-inline-flex top-2 ms-2">
                        <Link href="/cart" className="header-nav-features-toggle" aria-label="Cart">
                          <img src="/img/icons/icon-cart-big.svg" height="30" alt="Cart" className="header-nav-top-icon-img" />
                          {itemCount > 0 && (
                            <span className="cart-info">
                              <span className="cart-qty">{itemCount}</span>
                            </span>
                          )}
                        </Link>

                        {/* Mini cart dropdown */}
                        {cartItems.length > 0 && (
                          <div className="header-nav-features-dropdown" id="headerTopCartDropdown">
                            <ol className="mini-products-list">
                              {cartItems.slice(0, 3).map(item => (
                                <li className="item" key={item.id}>
                                  <Link href={`/shop/product/${item.item_id}`} title={item.name} className="product-image">
                                    <img src={item.image_url || "/img/products/product-grey-1.jpg"} alt={item.name} />
                                  </Link>
                                  <div className="product-details">
                                    <p className="product-name"><Link href={`/shop/product/${item.item_id}`}>{item.name}</Link></p>
                                    <p className="qty-price">{item.quantity}X <span className="price">${item.store_price.toFixed(2)}</span></p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                            <div className="actions">
                              <Link className="btn btn-dark" href="/cart">View Cart</Link>
                              <Link className="btn btn-primary" href="/checkout">Checkout</Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Nav bar */}
          <div className="header-nav-bar header-nav-bar-top-border bg-light p-relative z-index-1">
            <div className="header-container container">
              <div className="header-row">
                <div className="header-column">
                  <div className="header-row justify-content-end">
                    <div className="header-nav header-nav-line header-nav-top-line header-nav-top-line-with-border justify-content-start">
                      <div className="header-nav-main header-nav-main-square header-nav-main-dropdown-no-borders header-nav-main-effect-3 header-nav-main-sub-effect-1 w-100">
                        <nav className="collapse w-100">
                          <ul className="nav nav-pills w-100" id="mainNav">
                            <li className="dropdown">
                              <Link className="dropdown-item dropdown-toggle" href="/">Home</Link>
                            </li>
                            <li className="dropdown">
                              <Link className="dropdown-item dropdown-toggle" href="/about">About Us</Link>
                            </li>
                            {user && (
                              <li className="dropdown">
                                <Link className="dropdown-item dropdown-toggle" href="/account/orders">My Orders</Link>
                              </li>
                            )}
                          </ul>
                        </nav>
                      </div>
                      <button className="btn header-btn-collapse-nav" data-bs-toggle="collapse" data-bs-target=".header-nav-main nav">
                        <i className="fas fa-bars" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────────── */}
      <div role="main" className="main shop pt-4">
        {children}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer id="footer" className="footer-texts-more-lighten">
        <div className="container">
          <div className="row py-4 my-5">
            <div className="col-md-6 col-lg-3 mb-5 mb-lg-0">
              <h5 className="text-4 text-color-light mb-3">CONTACT INFO</h5>
              <ul className="list list-unstyled">
                <li className="pb-1 mb-2">
                  <span className="d-block font-weight-normal line-height-1 text-color-light">ADDRESS</span>
                  Your address here
                </li>
                <li className="pb-1 mb-2">
                  <span className="d-block font-weight-normal line-height-1 text-color-light">PHONE</span>
                  <a href="tel:+1234567890">(123) 456-7890</a>
                </li>
                <li className="pb-1 mb-2">
                  <span className="d-block font-weight-normal line-height-1 text-color-light">EMAIL</span>
                  <a href="mailto:info@gswtools.com">info@gswtools.com</a>
                </li>
                <li className="pb-1 mb-2">
                  <span className="d-block font-weight-normal line-height-1 text-color-light">HOURS</span>
                  Mon - Sat / 9:00AM - 6:00PM
                </li>
              </ul>
              <ul className="social-icons social-icons-clean-with-border social-icons-medium">
                <li className="social-icons-instagram">
                  <a href="http://www.instagram.com/" className="no-footer-css" target="_blank" title="Instagram" rel="noreferrer"><i className="fab fa-instagram" /></a>
                </li>
                <li className="social-icons-facebook mx-2">
                  <a href="http://www.facebook.com/" className="no-footer-css" target="_blank" title="Facebook" rel="noreferrer"><i className="fab fa-facebook-f" /></a>
                </li>
              </ul>
            </div>

            <div className="col-md-6 col-lg-3 mb-5 mb-lg-0">
              <h5 className="text-4 text-color-light mb-3">CUSTOMER SERVICE</h5>
              <ul className="list list-unstyled mb-0">
                <li className="mb-0"><Link href="/account/orders">My Orders</Link></li>
                <li className="mb-0"><Link href="/cart">Cart</Link></li>
                <li className="mb-0"><Link href="/auth/login">Sign In</Link></li>
                <li className="mb-0"><Link href="/auth/register">Create Account</Link></li>
                <li className="mb-0"><Link href="/about">About Us</Link></li>
              </ul>
            </div>

            <div className="col-md-6 col-lg-3 mb-5 mb-md-0">
              <h5 className="text-4 text-color-light mb-3">SHOP BY CATEGORY</h5>
              <ul className="list list-unstyled mb-0">
                <li className="mb-0"><Link href="/?cat=Power+Tools">Power Tools</Link></li>
                <li className="mb-0"><Link href="/?cat=Hand+Tools">Hand Tools</Link></li>
                <li className="mb-0"><Link href="/?cat=Measuring">Measuring</Link></li>
                <li className="mb-0"><Link href="/?cat=Safety">Safety</Link></li>
              </ul>
            </div>

            <div className="col-md-6 col-lg-3">
              <h5 className="text-4 text-color-light mb-3">IN-STORE PICKUP</h5>
              <p className="mb-2">Order online and collect your items at our store. We will notify you when your order is ready.</p>
              {!user && (
                <Link href="/auth/register" className="btn btn-primary btn-rounded btn-px-4 btn-py-2 font-weight-bold">
                  CREATE ACCOUNT
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="container">
          <div className="footer-copyright footer-copyright-style-2 pt-4 pb-5">
            <div className="row align-items-center justify-content-md-between">
              <div className="col-12 col-md-auto text-center text-md-start mb-2 mb-md-0">
                <p className="mb-0">Golden Stone Tools &copy; {new Date().getFullYear()}. All Rights Reserved</p>
              </div>
              <div className="col-12 col-md-auto">
                <div className="payment-cc justify-content-center justify-content-md-end">
                  <i className="fab fa-cc-visa" />
                  <i className="fab fa-cc-mastercard" />
                  <i className="fab fa-cc-apple-pay" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
