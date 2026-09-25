# Latest Changes

Updated September 24, 2026 on `feature/admin-payment-orders-safe`.

## Sales compliance

- Walk-in, manual, and payment-link sales require a buyer type, payment method, tax city, and tax ZIP.
- Entering a ZIP now automatically resolves and displays its canonical city and state; staff no longer type the tax city manually.
- Sale creation independently derives the city from the ZIP on the server and currently accepts Washington ZIP codes only, preventing a mismatched city from being saved.
- Supported payment methods are Cash, Zelle, and Square Up.
- Sales tax is calculated server-side from the ZIP rate; client-provided totals or tax rates are not trusted.
- Company purchases require a reseller permit in PDF, JPG, or PNG format.
- Staff must review the permit and either approve the tax exemption or charge the normal ZIP-based tax.
- Permit files are kept in a private Supabase Storage bucket and linked to the order.
- Orders, receipts, payment emails, Sales Reports, and CSV exports include the tax jurisdiction, tax charged, payment method, buyer type, and permit decision.
- Historical records retain `legacy_unknown` when their original payment method was never recorded.

## Sales Report

- Redesigned the report as a compact operations dashboard for desktop, tablet, and phone.
- Added tiered KPI cards, a dense secondary metric strip, always-visible item performance, staff share bars, and expandable order summaries.
- Mobile now uses Items, Orders, and Staff tabs with pinned item totals and compact CSV/QuickBooks controls.
- Added filters for All, Cash, Online orders, Payment-link orders, and Walk-in orders.
- Cash is filtered by payment method. Online, payment-link, and walk-in filters use the order source.
- A Square transaction includes any order whose payment method is Square Up, including a walk-in paid by credit card.
- Added Square gross, estimated Square fees, and final Square deposit totals.
- The estimate is calculated separately for every Square transaction:

  `final deposit = order total - (order total × 2.60% + $0.15)`

- Cash and Zelle transactions do not receive a Square processing fee.
- Square gross, fee, and final deposit values are included in the Sales Report CSV without duplicating order-level totals across multiple item rows.

## Admin interface

- Applied the Sales Report visual system across the admin shell: warm neutral background, white 12px cards, restrained borders, compact typography, and rust-orange active accents.
- Reworked the shared navigation for clearer active states, larger touch targets, a sticky desktop header, and a scroll-safe mobile menu.
- Redesigned the admin dashboard into compact KPI cards and dense grouped tool lists.
- Standardized page headers and spacing across orders, payment links, walk-in sales, past sales, inventory, receiving, purchase orders, packaging, categories, tax rates, discount codes, and staff access.

## Storefront hero

- Shortened the featured-product presentation and reduced the image height.
- Product images now use an uncropped contain fit so the complete inventory photo remains visible.
- Moved the description, pricing, product links, dimensions, pickup details, location, and live stock into a compact block below the image.
- Long descriptions use two columns on desktop and visible Markdown emphasis markers are removed.
- Kept the live inventory, trade-grade selection, and fast pickup benefits directly beneath the hero in a shorter row.

## Deployment

Apply the database migration before deploying application code:

```bash
npx supabase db push
```

Migration:

`supabase/migrations/20260924010000_order_compliance.sql`

Then deploy or push the branch normally:

```bash
git push origin feature/admin-payment-orders-safe
```

## Verification

- TypeScript: passed
- Application-targeted ESLint: passed
- Automated tests: 20 passed
- Next.js production build: passed

The repository-wide lint command still reports pre-existing errors in legacy third-party files under `public/`.
