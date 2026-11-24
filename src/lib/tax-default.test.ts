import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TAX_CITY, DEFAULT_TAX_ZIP } from "./tax-default";

test("the staff-sale tax jurisdiction is Auburn", () => {
  assert.equal(DEFAULT_TAX_ZIP, "98002");
  assert.equal(DEFAULT_TAX_CITY, "Auburn");
});
