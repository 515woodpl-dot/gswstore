import assert from "node:assert/strict";
import test from "node:test";
import { calculateLandedCosts, weightedAverageCost } from "./landedCost";

const lines = [
  { id: "X", quantity: 10, supplierUnitCost: 54, unitWeight: 20, manualAllocation: 0 },
  { id: "Y", quantity: 5, supplierUnitCost: 70, unitWeight: 40, manualAllocation: 0 },
  { id: "Z", quantity: 30, supplierUnitCost: 57, unitWeight: 10, manualAllocation: 0 },
];

test("allocates tariffs by item value and handling by quantity", () => {
  const result = calculateLandedCosts(lines, [
    { kind: "tariff", label: "Tariff", amount: 260 },
    { kind: "handling", label: "Handling", amount: 45 },
  ], "automatic");

  assert.equal(result.sharedExpenses, 305);
  assert.equal(result.lines.reduce((sum, line) => sum + line.allocatedExpense, 0), 305);
  assert.ok(result.lines[2].allocatedExpense > result.lines[0].allocatedExpense);
});

test("allocates freight by weight when every line has a weight", () => {
  const result = calculateLandedCosts(lines, [
    { kind: "freight", label: "Freight", amount: 700 },
  ], "automatic");

  assert.equal(result.freightUsesWeight, true);
  assert.deepEqual(result.lines.map((line) => line.allocatedExpense), [200, 200, 300]);
});

test("falls back to purchase value when a freight weight is missing", () => {
  const result = calculateLandedCosts(
    lines.map((line, index) => index === 1 ? { ...line, unitWeight: 0 } : line),
    [{ kind: "freight", label: "Freight", amount: 260 }],
    "automatic",
  );

  assert.equal(result.freightUsesWeight, false);
  assert.deepEqual(result.lines.map((line) => line.allocatedExpense), [54, 35, 171]);
});

test("accepts manual line allocations and reports an unmatched total", () => {
  const exact = calculateLandedCosts(
    lines.map((line, index) => ({ ...line, manualAllocation: [100, 75, 125][index] })),
    [{ kind: "other", label: "Shared costs", amount: 300 }],
    "manual",
  );
  const short = calculateLandedCosts(
    lines.map((line, index) => ({ ...line, manualAllocation: [100, 75, 100][index] })),
    [{ kind: "other", label: "Shared costs", amount: 300 }],
    "manual",
  );

  assert.equal(exact.manualDifference, 0);
  assert.equal(short.manualDifference, 25);
});

test("calculates the new weighted-average inventory cost", () => {
  assert.equal(weightedAverageCost(10, 50, 5, 80), 60);
  assert.equal(weightedAverageCost(0, 0, 4, 42.2578), 42.2578);
});
