import test from "node:test";
import assert from "node:assert/strict";
import {
  baseQuantityFromPackages,
  costForSale,
  costPerBaseUnitFromPackageCost,
  resolveSalePackage,
  cartPackageProblem,
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

test("uses the box price and 24 base units across sale channels", () => {
  const sealant = { units_per_sale: 1, store_price: 4.5, sale_price: null, box_enabled: true, box_price: 98.4 };
  assert.deepEqual(resolveSalePackage(sealant, 24), { packSize: 24, price: 98.4, isBox: true });
  assert.deepEqual(resolveSalePackage(sealant, 1), { packSize: 1, price: 4.5, isBox: false });
  assert.equal(resolveSalePackage({ ...sealant, box_enabled: false }, 24), null);
  assert.equal(resolveSalePackage(sealant, 12), null);
  assert.deepEqual(resolveSalePackage({ units_per_sale: 100, store_price: 27 }, 100), { packSize: 100, price: 27, isBox: false });
});

test("online checkout counts boxes and singles against the same stock", () => {
  const item = { id: "clear", amount: 27, units_per_sale: 1, store_price: 4.5, sale_price: null, box_enabled: true, box_price: 98.4 };
  const lines = [
    { item_id: "clear", name: "Clear — Box of 24", quantity: 1, units_per_sale: 24, store_price: 98.4, sale_price: null },
    { item_id: "clear", name: "Clear", quantity: 3, units_per_sale: 1, store_price: 4.5, sale_price: null },
  ];
  assert.equal(cartPackageProblem(lines, [item]), null);
  assert.match(cartPackageProblem(lines, [{ ...item, amount: 26 }])!, /more units than are in stock/);
  assert.match(cartPackageProblem(lines, [{ ...item, box_enabled: false }])!, /no longer available/);
});
