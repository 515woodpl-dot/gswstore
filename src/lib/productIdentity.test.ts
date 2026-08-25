import assert from "node:assert/strict";
import test from "node:test";
import { generateSmartProductIdentity, inferCategoryFromProductName } from "./productIdentity";

const categories = [
  { id: 1, name: "Sinks", prefix: "SNK" },
  { id: 2, name: "Silicone", prefix: "SIL" },
  { id: 3, name: "Brackets", prefix: "BRK" },
  { id: 4, name: "Professional Tools", prefix: "PWR" },
];

test("finds a category keyword anywhere in a product name", () => {
  assert.equal(inferCategoryFromProductName("Handmade stainless steel kitchen sink", categories)?.prefix, "SNK");
  assert.equal(inferCategoryFromProductName("Clear silicone sealant 10 oz", categories)?.prefix, "SIL");
  assert.equal(inferCategoryFromProductName("Heavy-duty shelf bracket", categories)?.prefix, "BRK");
});

test("ignores generic category words", () => {
  assert.equal(inferCategoryFromProductName("Cordless drill", categories), null);
});

test("generates the next category ID and SKU across existing formats", () => {
  const result = generateSmartProductIdentity(categories[0], [
    { id: "SNK001", sku: "SNK-0001" },
    { id: "SNK002", sku: "SNK-0002" },
    { id: "OTHER1", sku: "SNK-0010" },
  ]);

  assert.deepEqual(result, { id: "SNK011", sku: "SNK-0011", prefix: "SNK", sequence: 11 });
});
