import test from "node:test";
import assert from "node:assert/strict";
import {
  baseQuantityFromPackages,
  costForSale,
  costPerBaseUnitFromPackageCost,
} from "./packaging";

test("converts package quantities into base stock units", () => {
  assert.equal(baseQuantityFromPackages(10, 100), 1000);
});

test("calculates sale cost from the base-unit cost", () => {
  assert.equal(costForSale(0.27, 10, 100), 270);
});

test("converts a supplier package price to a base-unit price", () => {
  assert.equal(costPerBaseUnitFromPackageCost(27, 100), 0.27);
});
