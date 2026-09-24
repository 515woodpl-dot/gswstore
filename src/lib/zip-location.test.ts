import assert from "node:assert/strict";
import test from "node:test";
import { getZipLocation } from "./zip-location";

test("resolves Washington ZIP codes to their canonical city", () => {
  assert.deepEqual(getZipLocation("98002"), {
    city: "Auburn",
    state: "Washington",
    stateCode: "WA",
    county: "King",
  });
});

test("rejects malformed or unknown ZIP codes", () => {
  assert.equal(getZipLocation("9800"), null);
  assert.equal(getZipLocation("00000"), null);
});
