import assert from "node:assert/strict";
import test from "node:test";
import { isSquareWalkIn, walkInOrderState } from "./walk-in-payment";

test("only Square walk-ins wait for hosted payment", () => {
  assert.equal(isSquareWalkIn("square"), true);
  assert.deepEqual(walkInOrderState("square"), { status: "awaiting_payment", paymentStatus: "unpaid" });
  assert.deepEqual(walkInOrderState("cash"), { status: "completed", paymentStatus: "paid" });
  assert.deepEqual(walkInOrderState("zelle"), { status: "completed", paymentStatus: "paid" });
});
