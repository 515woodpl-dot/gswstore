import assert from "node:assert/strict";
import test from "node:test";
import { isSquareWalkIn, walkInOrderState } from "./walk-in-payment";

test("only Square walk-ins wait for hosted payment", () => {
  assert.equal(isSquareWalkIn("square"), true);
  assert.deepEqual(walkInOrderState("square"), { status: "awaiting_payment", payment_status: "unpaid" });
  assert.deepEqual(walkInOrderState("cash"), { status: "completed", payment_status: "paid" });
  assert.deepEqual(walkInOrderState("zelle"), { status: "completed", payment_status: "paid" });
});
