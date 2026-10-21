import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTaxZipOverride, percentToTaxRate } from "./tax-overrides";

test("converts a percentage to a decimal tax rate with strict bounds", () => {
  assert.ok(Math.abs(percentToTaxRate("10.4")! - 0.104) < 1e-10);
  assert.equal(percentToTaxRate("0"), 0);
  assert.equal(percentToTaxRate("25"), 0.25);
  for (const value of ["", "10abc", "-1", "25.01", "10.12345", null]) assert.equal(percentToTaxRate(value), null);
});

test("loads only the requested ZIP override and preserves a zero rate", async () => {
  let requestedKey = "";
  const client = {
    from: (table: string) => {
      assert.equal(table, "store_settings");
      return { select: () => ({ eq: (_column: string, key: string) => {
        requestedKey = key;
        return { maybeSingle: async () => ({ data: { value: "0" }, error: null }) };
      } }) };
    },
  } as unknown as SupabaseClient;
  assert.equal(await getTaxZipOverride(client, "98101"), 0);
  assert.equal(requestedKey, "tax_zip_override_98101");
});

test("rejects corrupt or unavailable override settings instead of silently changing tax", async () => {
  const fake = (data: unknown, error: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) }) as unknown as SupabaseClient;
  assert.equal(await getTaxZipOverride(fake(null, null), "98101"), null);
  await assert.rejects(getTaxZipOverride(fake({ value: "broken" }, null), "98101"));
  await assert.rejects(getTaxZipOverride(fake(null, { message: "database unavailable" }), "98101"));
});
