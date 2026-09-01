# GSW Cost, Packaging, and Profit Calculator

## Purpose

This document explains the complete inventory cost and sales profit system used by GSW Store. It is also a handoff guide for another developer or AI session.

The feature connects five business operations:

1. Receive products from a supplier.
2. Allocate freight, tariffs, taxes, handling, and other shared expenses.
3. Convert packages, bags, cases, sets, and other purchasing units into base inventory units.
4. Snapshot cost and packaging when an item is sold.
5. Calculate net revenue, cost, profit, and margin without changing historical results when inventory costs change later.

## Most Important Data Rule

The system uses different units for stock and sales:

- `inventory.amount`: quantity currently available, stored in base units.
- `inventory.cost_price`: weighted-average landed cost per base unit.
- `inventory.base_unit`: smallest stock unit, such as Each, Clip, Blade, Tube, or Piece.
- `inventory.selling_unit`: unit sold to the customer, such as Each, Bag, Pack, Box, Case, Set, Roll, or Pallet.
- `inventory.units_per_sale`: number of base units removed for one selling unit.
- `order_items.quantity`: number of selling units sold.
- `order_items.cost_price`: historical snapshot of cost per base unit at sale time.
- `order_items.base_units_per_sale`: historical snapshot of the packaging multiplier at sale time.

Never treat `cost_price` as cost per bag or cost per case. It is cost per base unit.

## End-to-End Flow

### 1. Packaging setup

Every product must define:

```text
Base stock unit       = smallest unit counted in inventory
Customer selling unit = unit purchased by the customer
Units per sale         = base units removed by one sale
```

Examples:

| Product | Base unit | Selling unit | Units per sale |
| --- | --- | --- | ---: |
| Silicone tube | Tube | Each | 1 |
| Sink clips | Clip | Bag | 100 |
| Razor blades | Blade | Pack | 100 |
| Sink bracket kit | Piece | Set | 8 |
| Fasteners | Piece | Box | 500 |

The Packaging Review UI saves this through the `review_inventory_packaging` PostgreSQL function.

### 2. Receiving supplier products

The Receiving page creates one receipt or shipment batch with a token such as:

```text
RCV-20260831-ZLB00
```

That token groups all products and shared expenses from the same supplier order.

For each receipt line, staff enters:

- Product.
- Purchase quantity.
- Purchase unit, such as Bag, Box, Case, Pallet, or Each.
- Base units inside each purchase unit.
- Supplier cost per purchase unit.
- Optional weight.

The UI converts purchase packages into base units before calculating landed cost:

```text
base quantity = purchase quantity * base units per purchase unit
supplier cost per base unit = supplier package cost / base units per purchase unit
```

### 3. Shared expense allocation

Supported expense types:

- Freight or delivery.
- Tariffs or duties.
- Import tax or fees.
- Handling.
- Other shared expense.

Automatic allocation rules:

| Expense | Allocation rule |
| --- | --- |
| Freight | By weight when every line has a positive weight; otherwise by purchase value |
| Tariff | By purchase value |
| Import tax or fee | By purchase value |
| Handling | By base quantity |
| Other | By purchase value, with quantity fallback when all values are zero |

Manual allocation is also supported. In manual mode, the sum allocated to receipt lines must exactly match total shared expenses within one cent.

The TypeScript preview uses cent-safe proportional splitting. Remaining rounding cents are assigned deterministically so allocated expenses equal the expense total.

### 4. Landed cost

For each received product:

```text
line purchase subtotal = base quantity * supplier cost per base unit

landed cost per base unit =
  supplier cost per base unit
  + allocated shared expense / base quantity
```

The receipt total is:

```text
landed total = product subtotal + shared expenses
```

### 5. Weighted-average inventory cost

Receiving new stock does not replace the cost of inventory already on hand. It calculates a new weighted average:

```text
new average cost =
  ((old base quantity * old average cost)
  + (received base quantity * received landed unit cost))
  / (old base quantity + received base quantity)
```

The database stores the result in `inventory.cost_price` rounded to four decimal places.

### 6. Sale-time snapshots

The `order_item_cost_snapshot` trigger runs before every new `order_items` row is inserted. It reads the product from inventory and saves:

```text
order_items.cost_price = inventory.cost_price
order_items.base_units_per_sale = inventory.units_per_sale
```

This trigger is the authoritative snapshot for online checkout, Walk-in POS, and catalog products in Manual Sale.

The reason for snapshots is historical accuracy. Changing a product's current inventory cost or packaging later must not change the cost of a completed sale.

### 7. Stock decrement

Every normal product sale calls `decrement_packaged_inventory`:

```text
base units removed = selling quantity * units per sale
new stock = old base stock - base units removed
```

The SQL function locks the inventory row and rejects a sale that would create negative stock.

### 8. Sales calculations

For each sold line:

```text
list sales = list price * selling quantity
net revenue = actual sold unit price * selling quantity
discount = list sales - net revenue

line cost =
  historical cost per base unit
  * historical base units per sale
  * selling quantity

line profit = net revenue - line cost
line margin percent = line profit / net revenue * 100
```

Report totals:

```text
revenue = sum of item net revenue, excluding sales tax
cost = sum of line cost
profit = revenue - cost
margin = profit / revenue * 100
```

The report shows green margin at 20 percent or higher and amber below 20 percent. Negative profit or margin is red.

### 9. Discounts

Discounts change revenue, not cost.

For a line sold below list price:

```text
discount amount = (list unit price - sold unit price) * quantity
```

The report uses actual collected item revenue after discount. Product cost is unchanged, so the discount reduces profit and margin.

Online percentage codes calculate the discounted unit price before inserting the order item. Walk-in and Manual Sale allow staff to edit the sold price and require a discount reason.

Editing a historical sold price through the Sales Report recalculates:

- Line discount.
- Order total.
- Order discount total.
- Report revenue.
- Profit and margin.
- CSV output.

It does not change the historical cost snapshot.

### 10. Internal use and donations

Orders marked with:

```text
orders.transaction_type = 'internal_use'
```

are excluded from:

- Sales revenue.
- Sales discounts.
- Sales profit.
- Sales margin.
- Sales CSV export.
- QuickBooks sales export.

They remain visible in the order list and their units are counted separately as internal-use units.

The confirmed donation `GSW-20260801-S6EWQI` is classified by `MIGRATION_REPAIR_HISTORICAL_SALES.sql`.

### 11. Missing historical costs

Old order items created before cost snapshots may contain `cost_price = 0`.

The report deliberately displays `Missing` and hides profit and margin. It does not pretend unknown cost is zero, including free samples that collected $0 but still consumed inventory.

The Sales Report button `Backfill from current inventory costs` calls the admin API and then the `backfill_missing_sale_costs` SQL function.

The repair:

- Updates only historical rows whose cost is zero or missing.
- Requires a positive current `inventory.cost_price`.
- Never replaces an existing historical cost.
- Preserves the existing historical packaging multiplier.
- Uses today's weighted-average landed cost as an estimate, not an exact historical fact.

If the current inventory cost is also zero, the line stays `Missing`. Enter or receive a valid landed cost first.

## Worked Packaging Example

Assume the supplier ships 10 bags of clips:

```text
Purchase unit: Bag
Purchase quantity: 10
Clips per bag: 100
Supplier cost per bag: $27.00
Allocated freight and tariff for this line: $30.00
Customer selling unit: Bag
Clips per customer bag: 100
```

Receiving math:

```text
base quantity = 10 * 100 = 1,000 clips
supplier cost per clip = $27 / 100 = $0.27
shared expense per clip = $30 / 1,000 = $0.03
landed cost per clip = $0.27 + $0.03 = $0.30
```

Inventory stores:

```text
amount = 1,000
cost_price = $0.30
base_unit = Clip
selling_unit = Bag
units_per_sale = 100
```

If one customer bag sells for $45:

```text
selling quantity = 1 bag
base units removed = 1 * 100 = 100 clips
sale cost = $0.30 * 100 * 1 = $30
revenue = $45
profit = $45 - $30 = $15
margin = $15 / $45 = 33.33 percent
remaining inventory = 900 clips
```

This is why multiplying only `$0.30 * 1` is incorrect. It would report a false cost of 30 cents for an entire bag.

## SQL Migrations

Run migrations in Supabase SQL Editor. They are migrations, not daily commands. Do not run them for every receipt.

Recommended dependency order for a new database:

1. `MIGRATION_COST_PRICE.sql`
2. `MIGRATION_INVENTORY_RECEIVING.sql`
3. `MIGRATION_UNITS_PACKAGING.sql`
4. `MIGRATION_UNITS_PACKAGING_V2.sql`
5. `MIGRATION_INTERNAL_USE.sql`
6. `MIGRATION_REPAIR_HISTORICAL_SALES.sql`
7. `MIGRATION_DISCOUNT_CODES.sql` when online discount codes are required

Migration responsibilities:

### `MIGRATION_COST_PRICE.sql`

- Adds `inventory.cost_price`.
- Adds `order_items.cost_price`.
- Performs a best-effort initial historical backfill.

### `MIGRATION_INVENTORY_RECEIVING.sql`

- Creates receipt, receipt-line, and receipt-expense tables.
- Creates receipt batch tokens.
- Implements `receive_inventory_batch`.
- Allocates shared expenses.
- Calculates landed unit costs.
- Updates weighted-average inventory cost.
- Tracks remaining quantity by receipt layer.
- Supports missed-expense corrections and receipt reversal.
- Contains safe inventory deletion support in its latest version.

### `MIGRATION_UNITS_PACKAGING.sql`

- Adds base, selling, and purchase-unit columns.
- Adds package conversion factors to inventory, carts, order items, and receipt lines.

### `MIGRATION_UNITS_PACKAGING_V2.sql`

- Adds packaging review status.
- Creates the sale-time cost and packaging snapshot trigger.
- Creates transaction-safe packaged inventory decrement.
- Creates the Packaging Review RPC.

Important historical warning: this migration contains historical `base_units_per_sale` backfill logic. Do not repeatedly change old sale multipliers unless the old sale quantity is known to use the same selling unit. A wrong multiplier can create extremely large false cost or profit values.

### `MIGRATION_INTERNAL_USE.sql`

- Adds `orders.transaction_type`.
- Adds `orders.internal_use_reason`.

### `MIGRATION_REPAIR_HISTORICAL_SALES.sql`

- Classifies the confirmed donation order.
- Creates the admin-only historical cost backfill function.
- Repairs cost only and intentionally does not modify packaging snapshots.

### `MIGRATION_DISCOUNT_CODES.sql`

- Creates online percentage discount codes used by checkout and the promotional banner feature.

## Source Files

### Core calculator logic

- `src/lib/landedCost.ts`: expense allocation, landed unit cost, and weighted-average cost.
- `src/lib/packaging.ts`: package conversion and sale cost helpers.
- `src/lib/landedCost.test.ts`: allocation and weighted-average tests.
- `src/lib/packaging.test.ts`: packaging conversion and sale-cost tests.

### Receiving and inventory

- `src/components/admin/ReceivingManager.tsx`: receiving UI, live calculation preview, package conversion, RPC payload, missed expenses, and forecast.
- `src/app/admin/receiving/page.tsx`: loads receiving products, categories, and receipt history.
- `src/components/admin/PackagingReview.tsx`: packaging review UI.
- `src/app/admin/inventory/packaging/page.tsx`: loads packaging review data.
- `src/components/admin/SupplyUnitField.tsx`: supply-store unit selector.
- `src/components/admin/InventoryManager.tsx`: editable average landed cost and packaging fields.
- `src/lib/inventory.ts`: inventory database mapping.
- `src/types/index.ts`: shared inventory, cart, and order types.

### Sale creation and stock consumption

- `src/lib/utils.ts`: online order creation, discount math, order item insertion, and packaged stock decrement.
- `src/lib/cart.ts`: preserves packaging fields in the cart.
- `src/components/admin/WalkInPos.tsx`: walk-in prices, discounts, snapshots, and stock decrement.
- `src/components/admin/ManualSale.tsx`: manual sale prices, discounts, optional stock decrement, and packaging values.

### Reporting and repairs

- `src/components/admin/SalesReport.tsx`: report aggregation, missing-cost protection, exports, price editing controls, internal-use handling, and historical cost repair UI.
- `src/app/admin/sales/page.tsx`: server-side sales and inventory query.
- `src/app/api/admin/edit-sale-item/route.ts`: recalculates an edited historical selling price and discounts.
- `src/app/api/admin/internal-use/route.ts`: classifies a sale as internal use or donation.
- `src/app/api/admin/backfill-sale-costs/route.ts`: admin API for the historical cost repair RPC.

## Database Source of Truth

The Receiving UI preview is useful feedback, but PostgreSQL is authoritative for inventory changes. `receive_inventory_batch` performs receipt creation, allocation, landed cost, weighted average, and stock updates inside one database operation.

The database trigger is authoritative for sale cost snapshots. Client code may include cost fields in an insert payload, but the trigger replaces them from inventory for matching products.

## Safety Requirements for Future Changes

1. Never calculate sale cost as only `cost_price * quantity` when `units_per_sale` may exceed one.
2. Never store package cost in `inventory.cost_price`; convert it to base-unit cost first.
3. Never recalculate completed sale cost from current inventory during normal reporting.
4. Never overwrite a nonzero historical cost during backfill.
5. Never change a historical packaging multiplier without knowing what the original sale quantity represented.
6. Never include sales tax in product revenue or product profit.
7. Never treat a free item as having no cost.
8. Never include internal-use or donation transactions in sales revenue exports.
9. Keep the TypeScript preview and PostgreSQL allocation formulas synchronized.
10. Preserve row locking and negative-stock checks in inventory RPCs.

## Validation

Run:

```bash
npx eslint src/lib/landedCost.ts src/lib/packaging.ts src/components/admin/SalesReport.tsx src/app/api/admin/backfill-sale-costs/route.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Expected unit-test coverage includes:

- Tariff allocation by value.
- Handling allocation by quantity.
- Freight allocation by weight.
- Freight fallback to value.
- Manual allocation difference.
- Weighted-average inventory cost.
- Package-to-base quantity conversion.
- Package-cost-to-base-cost conversion.
- Sale cost using base-unit cost and packaging multiplier.

Repository-wide `npm run lint` currently scans bundled third-party JavaScript under `public/` and reports many unrelated pre-existing errors. Use targeted lint until the ESLint ignore configuration is corrected.

## Current Historical Repair Example

The confirmed donation order is:

```text
GSW-20260801-S6EWQI
24 Senta Silicone - Translucent White
Collected: $0.00
Classification: Internal Use / Donation
```

After classification, expected report changes for the supplied historical data are:

```text
Units sold: 296 -> 272
List sales: $1,334.40 -> $1,226.40
Discounts: $267.70 -> $159.70
Net revenue: remains $1,066.70
Internal-use units: 24
```

Cost, profit, and margin become available only after the affected products have a positive Average Landed Cost and the historical backfill is run.

## Handoff State

This guide was generated from repository commit `932fc1f` plus the current uncommitted historical repair changes on 2026-09-01. Review `git status` before applying additional changes or creating a commit.
