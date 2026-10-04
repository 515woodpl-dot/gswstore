export type AllocationMode = "automatic" | "manual";

export type ExpenseKind = "freight" | "tariff" | "tax" | "handling" | "other";

export interface LandedCostExpense {
  kind: ExpenseKind;
  label: string;
  amount: number;
}

export interface LandedCostLine {
  id: string;
  quantity: number;
  supplierUnitCost: number;
  unitWeight: number;
  manualAllocation: number;
  purchaseUnit?: string;
  baseUnitsPerPurchase?: number;
}

export interface CalculatedLandedCostLine extends LandedCostLine {
  itemSubtotal: number;
  allocatedExpense: number;
  landedUnitCost: number;
}

export interface LandedCostCalculation {
  lines: CalculatedLandedCostLine[];
  itemSubtotal: number;
  sharedExpenses: number;
  landedTotal: number;
  manualDifference: number;
  freightUsesWeight: boolean;
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;
const safe = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;

function splitAmount(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + safe(weight), 0);
  if (amount <= 0 || totalWeight <= 0) return weights.map(() => 0);

  const totalCents = Math.round(amount * 100);
  const rawShares = weights.map((weight) => totalCents * safe(weight) / totalWeight);
  const shares = rawShares.map(Math.floor);
  let remainder = totalCents - shares.reduce((sum, share) => sum + share, 0);

  rawShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        shares[index] += 1;
        remainder -= 1;
      }
    });

  return shares.map((share) => share / 100);
}

function expenseWeights(kind: ExpenseKind, lines: LandedCostLine[], freightUsesWeight: boolean): number[] {
  if (kind === "handling") return lines.map((line) => safe(line.quantity));
  if (kind === "freight" && freightUsesWeight) {
    return lines.map((line) => safe(line.quantity) * safe(line.unitWeight));
  }

  const valueWeights = lines.map((line) => safe(line.quantity) * safe(line.supplierUnitCost));
  if (valueWeights.some((weight) => weight > 0)) return valueWeights;
  return lines.map((line) => safe(line.quantity));
}

export function calculateLandedCosts(
  lines: LandedCostLine[],
  expenses: LandedCostExpense[],
  mode: AllocationMode,
): LandedCostCalculation {
  const normalizedLines = lines.map((line) => ({
    ...line,
    quantity: safe(line.quantity),
    supplierUnitCost: safe(line.supplierUnitCost),
    unitWeight: safe(line.unitWeight),
    manualAllocation: safe(line.manualAllocation),
  }));
  const normalizedExpenses = expenses.map((expense) => ({ ...expense, amount: safe(expense.amount) }));
  const sharedExpenses = cents(normalizedExpenses.reduce((sum, expense) => sum + expense.amount, 0));
  const itemSubtotal = cents(normalizedLines.reduce(
    (sum, line) => sum + line.quantity * line.supplierUnitCost,
    0,
  ));
  const freightUsesWeight = normalizedLines.length > 0 && normalizedLines.every(
    (line) => line.quantity > 0 && line.unitWeight > 0,
  );

  let allocations: number[];
  if (mode === "manual") {
    allocations = normalizedLines.map((line) => cents(line.manualAllocation));
  } else {
    allocations = normalizedLines.map(() => 0);
    for (const expense of normalizedExpenses) {
      const shares = splitAmount(
        expense.amount,
        expenseWeights(expense.kind, normalizedLines, freightUsesWeight),
      );
      allocations = allocations.map((current, index) => cents(current + shares[index]));
    }
  }

  const allocatedTotal = cents(allocations.reduce((sum, allocation) => sum + allocation, 0));
  const calculatedLines = normalizedLines.map((line, index) => {
    const itemSubtotalForLine = money(line.quantity * line.supplierUnitCost);
    const allocatedExpense = cents(allocations[index]);
    return {
      ...line,
      itemSubtotal: itemSubtotalForLine,
      allocatedExpense,
      landedUnitCost: line.quantity > 0
        ? money(line.supplierUnitCost + allocatedExpense / line.quantity)
        : 0,
    };
  });

  return {
    lines: calculatedLines,
    itemSubtotal,
    sharedExpenses,
    landedTotal: cents(itemSubtotal + sharedExpenses),
    manualDifference: cents(sharedExpenses - allocatedTotal),
    freightUsesWeight,
  };
}

export function weightedAverageCost(
  currentQuantity: number,
  currentUnitCost: number,
  receivedQuantity: number,
  receivedUnitCost: number,
): number {
  const oldQuantity = safe(currentQuantity);
  const newQuantity = safe(receivedQuantity);
  const totalQuantity = oldQuantity + newQuantity;
  if (totalQuantity <= 0) return 0;

  return money(
    (oldQuantity * safe(currentUnitCost) + newQuantity * safe(receivedUnitCost)) / totalQuantity,
  );
}

// ── Pricing help ─────────────────────────────────────────────────────────────
// Landed cost is stored per BASE unit. Customers buy SELLING units, so the cost
// of one sale is landed cost × base units per sale.

export function costPerSellingUnit(landedUnitCost: number, unitsPerSale?: number | null): number {
  const factor = Number(unitsPerSale);
  const units = Number.isFinite(factor) && factor > 0 ? Math.floor(factor) : 1;
  return money(safe(landedUnitCost) * units);
}

/** Margin = profit ÷ selling price, as a percentage. Null when there is no price. */
export function marginPercent(sellingPrice: number, cost: number): number | null {
  const price = safe(sellingPrice);
  if (price <= 0) return null;
  return ((price - safe(cost)) / price) * 100;
}

/** Lowest price (rounded up to the cent) that reaches the target margin. */
export function priceForMargin(cost: number, targetMarginPercent: number): number | null {
  const target = Number(targetMarginPercent);
  if (!Number.isFinite(target) || target < 0 || target >= 100) return null;
  const unitCost = safe(cost);
  if (unitCost <= 0) return null;
  return Math.ceil((unitCost / (1 - target / 100)) * 100 - 1e-7) / 100;
}
