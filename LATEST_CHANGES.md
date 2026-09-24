# Latest Changes

Updated September 24, 2026 on `feature/admin-payment-orders-safe`.

## Sales compliance

- Walk-in, manual, and payment-link sales require a buyer type, payment method, tax city, and tax ZIP.
- Supported payment methods are Cash, Zelle, and Square Up.
- Sales tax is calculated server-side from the ZIP rate; client-provided totals or tax rates are not trusted.
- Company purchases require a reseller permit in PDF, JPG, or PNG format.
- Staff must review the permit and either approve the tax exemption or charge the normal ZIP-based tax.
- Permit files are kept in a private Supabase Storage bucket and linked to the order.
- Orders, receipts, payment emails, Sales Reports, and CSV exports include the tax jurisdiction, tax charged, payment method, buyer type, and permit decision.
- Historical records retain `legacy_unknown` when their original payment method was never recorded.

## Sales Report

- Added filters for All, Cash, Online orders, Payment-link orders, and Walk-in orders.
- Cash is filtered by payment method. Online, payment-link, and walk-in filters use the order source.
- A Square transaction includes any order whose payment method is Square Up, including a walk-in paid by credit card.
- Added Square gross, estimated Square fees, and final Square deposit totals.
- The estimate is calculated separately for every Square transaction:

  `final deposit = order total - (order total × 2.60% + $0.15)`

- Cash and Zelle transactions do not receive a Square processing fee.
- Square gross, fee, and final deposit values are included in the Sales Report CSV without duplicating order-level totals across multiple item rows.

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
- Automated tests: 18 passed
- Next.js production build: passed

The repository-wide lint command still reports pre-existing errors in legacy third-party files under `public/`.
