import test from "node:test";
import assert from "node:assert/strict";
import { applyDefaultZip, applyZipLookup } from "./sale-zip";

test("a delayed default never replaces a ZIP the cashier edited", () => {
  const current = { taxZip: "98101", taxCity: "Seattle", buyerType: "personal" };
  assert.deepEqual(applyDefaultZip(current, "98002", "Auburn", true), current);
  assert.deepEqual(applyDefaultZip({ ...current, taxZip: "", taxCity: "" }, "98002", "Auburn", true), { ...current, taxZip: "", taxCity: "" });
  assert.equal(applyDefaultZip({ ...current, taxZip: "", taxCity: "" }, "98002", "Auburn", false).taxZip, "98002");
});

test("a delayed ZIP lookup cannot overwrite the current ZIP or other form selections", () => {
  const current = { taxZip: "98101", taxCity: "", buyerType: "company" };
  assert.deepEqual(applyZipLookup(current, "98002", "Auburn"), current);
  assert.deepEqual(applyZipLookup(current, "98101", "Seattle"), { ...current, taxCity: "Seattle" });
});
