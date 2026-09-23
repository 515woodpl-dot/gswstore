// ── Server-side money math for admin-created / payment-link orders ──────────
// All inputs/outputs are plain decimal dollars rounded to the cent, matching
// the rest of the app's existing NUMERIC(money) convention (see
// src/app/api/admin/walk-in-sale/route.ts). Cents-based integer math is used
// internally for every accumulation so repeated rounding never drifts.
//
// This module is the single source of truth for order totals so the "admin
// creates it" screen, "send payment link", "add/cancel item", and refund
// calculations can never disagree with each other.

export interface DraftLine {
  itemId: string;
  quantity: number;
  /** Catalog price per unit, in dollars, BEFORE any line-level discount. */
  listPrice: number;
  /** Optional per-line discount already decided by the admin, in dollars per line (not per unit). */
  lineDiscount?: number;
}

export interface OrderDiscount {
  type: "percent" | "fixed" | "";
  value: number; // percent (0-100) or fixed dollar amount
}

export interface ComputedLine {
  itemId: string;
  quantity: number;
  listPrice: number;
  lineDiscountCents: number;
  /** Effective unit price after the line discount is spread evenly (for display / unit_price column). */
  unitPriceCents: number;
  lineTotalCents: number; // listPrice*qty - lineDiscount, before order-level discount/tax
}

export interface ComputedOrder {
  lines: ComputedLine[];
  subtotalCents: number;       // sum of list prices * qty, no discounts
  lineDiscountCents: number;   // sum of per-line discounts
  orderDiscountCents: number;  // order-level discount applied on top
  discountTotalCents: number;  // lineDiscountCents + orderDiscountCents
  taxableCents: number;        // subtotal - all discounts
  taxCents: number;
  totalCents: number;
}

export function toCents(dollars: number): number {
  return Math.round(Number(dollars) * 100);
}

export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Computes an order's full financial breakdown server-side. Never trust a
 * total/subtotal/tax value sent from the browser — recompute from line
 * items + discount + tax rate every time.
 */
export function computeOrder(
  lines: DraftLine[],
  orderDiscount: OrderDiscount | undefined,
  taxRate: number,
): ComputedOrder {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("An order needs at least one item.");
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 0.25) {
    throw new Error("Tax rate is invalid.");
  }

  let subtotalCents = 0;
  let lineDiscountCents = 0;

  const computedLines: ComputedLine[] = lines.map((line) => {
    const qty = Math.trunc(Number(line.quantity));
    const listPrice = Number(line.listPrice);
    if (!line.itemId || !Number.isInteger(qty) || qty <= 0 || qty > 10_000) {
      throw new Error("One or more line quantities are invalid.");
    }
    if (!Number.isFinite(listPrice) || listPrice < 0 || listPrice > 1_000_000) {
      throw new Error("One or more line prices are invalid.");
    }
    const lineListCents = toCents(listPrice) * qty;
    let discCents = Math.max(0, Math.round(toCents(line.lineDiscount ?? 0)));
    // Never allow a line discount to create a negative line total.
    discCents = Math.min(discCents, lineListCents);
    const lineTotalCents = lineListCents - discCents;
    subtotalCents += lineListCents;
    lineDiscountCents += discCents;
    return {
      itemId: line.itemId,
      quantity: qty,
      listPrice,
      lineDiscountCents: discCents,
      unitPriceCents: Math.round(lineTotalCents / qty),
      lineTotalCents,
    };
  });

  const afterLineDiscountCents = subtotalCents - lineDiscountCents;

  let orderDiscountCents = 0;
  if (orderDiscount && orderDiscount.type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(orderDiscount.value) || 0));
    orderDiscountCents = Math.round(afterLineDiscountCents * (pct / 100));
  } else if (orderDiscount && orderDiscount.type === "fixed") {
    orderDiscountCents = Math.round(toCents(Math.max(0, Number(orderDiscount.value) || 0)));
  }
  // Never allow the order-level discount to take the order below zero.
  orderDiscountCents = Math.min(orderDiscountCents, afterLineDiscountCents);

  const taxableCents = afterLineDiscountCents - orderDiscountCents;
  const taxCents = Math.round(taxableCents * taxRate);
  const totalCents = taxableCents + taxCents;

  return {
    lines: computedLines,
    subtotalCents,
    lineDiscountCents,
    orderDiscountCents,
    discountTotalCents: lineDiscountCents + orderDiscountCents,
    taxableCents,
    taxCents,
    totalCents,
  };
}

export interface SquareLinePlan {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number; // net of ALL discounts (line + prorated order-level)
  lineTotalCents: number;
}

/**
 * Square's Payment Links API can't apply one discount object cleanly across
 * an order while also adding a plain-dollar tax line without the discount
 * bleeding onto the tax line too. To keep the amount the customer is charged
 * byte-for-byte identical to our own computed total, we instead bake the
 * order-level discount directly into each line's unit price (prorated by
 * line weight, largest-remainder method so cents always reconcile exactly),
 * then add tax as its own flat line item.
 */
export function toSquareLinePlan(
  computed: ComputedOrder,
  names: Record<string, string>,
): { lines: SquareLinePlan[]; taxCents: number; totalCents: number } {
  const { lines, orderDiscountCents, taxCents } = computed;
  const afterLineDiscountTotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);

  // Largest-remainder proration of the order-level discount across source
  // lines. This keeps every cent assigned to exactly one product line.
  const finalShares = new Array(lines.length).fill(0);
  if (orderDiscountCents > 0 && afterLineDiscountTotal > 0) {
    const shares = lines.map((l) => (l.lineTotalCents * orderDiscountCents) / afterLineDiscountTotal);
    const floorShares = shares.map(Math.floor);
    const remaining = orderDiscountCents - floorShares.reduce((a, b) => a + b, 0);
    const remainders = shares.map((s, i) => ({ i, frac: s - floorShares[i] }));
    remainders.sort((a, b) => b.frac - a.frac);
    floorShares.forEach((share, i) => { finalShares[i] = share; });
    for (let k = 0; k < remaining; k++) finalShares[remainders[k % remainders.length].i] += 1;
  }

  // A quantity of three cannot represent a $29.00 line with one integer-cent
  // unit price. Split it into at most two Square lines (for example 2 × $9.67
  // and 1 × $9.66) so Square charges the exact authoritative total.
  const finalLines: SquareLinePlan[] = [];
  lines.forEach((line, i) => {
    const netLineTotal = Math.max(0, line.lineTotalCents - finalShares[i]);
    const lowUnit = Math.floor(netLineTotal / line.quantity);
    const highUnitCount = netLineTotal - lowUnit * line.quantity;
    const lowUnitCount = line.quantity - highUnitCount;
    const name = names[line.itemId] || line.itemId;
    if (highUnitCount > 0) {
      finalLines.push({ itemId: line.itemId, name, quantity: highUnitCount, unitPriceCents: lowUnit + 1, lineTotalCents: highUnitCount * (lowUnit + 1) });
    }
    if (lowUnitCount > 0) {
      finalLines.push({ itemId: line.itemId, name, quantity: lowUnitCount, unitPriceCents: lowUnit, lineTotalCents: lowUnitCount * lowUnit });
    }
  });

  const totalCents = finalLines.reduce((s, l) => s + l.lineTotalCents, 0) + taxCents;
  return { lines: finalLines, taxCents, totalCents };
}

export function orderNumber(prefix = "GSW"): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}
