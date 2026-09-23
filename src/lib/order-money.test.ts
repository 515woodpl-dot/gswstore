import assert from "node:assert/strict";
import test from "node:test";
import { computeOrder, toSquareLinePlan } from "./order-money";

test("Square plan preserves cents when a line discount cannot divide evenly", () => {
  const order = computeOrder(
    [{ itemId: "blade", quantity: 3, listPrice: 10, lineDiscount: 1 }],
    undefined,
    0,
  );
  const plan = toSquareLinePlan(order, { blade: "Blade" });

  assert.equal(order.totalCents, 2900);
  assert.equal(plan.totalCents, order.totalCents);
  assert.equal(plan.lines.reduce((sum, line) => sum + line.lineTotalCents, 0), 2900);
});

test("Square plan preserves cents for an order-level discount", () => {
  const order = computeOrder(
    [{ itemId: "blade", quantity: 3, listPrice: 10 }],
    { type: "fixed", value: 1 },
    0,
  );
  const plan = toSquareLinePlan(order, { blade: "Blade" });

  assert.equal(plan.totalCents, order.totalCents);
  assert.equal(plan.lines.length, 2);
});
