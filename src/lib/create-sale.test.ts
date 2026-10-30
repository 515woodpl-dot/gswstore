import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSale, rollbackCreatedSale } from "./create-sale";

function saleDatabase() {
  const savedItems: Record<string, unknown>[] = [];
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const inventory = [{
    id: "clear", name: "Clear Sealant", sku: "SILC-0001", image_url: null,
    amount: 100, store_price: 4.5, sale_price: null, cost_price: 2,
    units_per_sale: 1, box_enabled: true, box_price: 98.4,
  }];
  const admin = {
    from(table: string) {
      if (table === "inventory") return { select: () => ({ in: async () => ({ data: inventory, error: null }) }) };
      if (table === "orders") return {
        insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => ({ data: { ...row, id: "order-1" }, error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
      if (table === "order_items") return {
        insert: (rows: Record<string, unknown>[]) => ({ select: async () => {
          savedItems.push(...rows);
          return { data: rows, error: null };
        } }),
      };
      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { error: null };
    },
  } as unknown as SupabaseClient;
  return { admin, savedItems, calls };
}

test("payment links price mixed single and box lines from one stock item", async () => {
  const db = saleDatabase();
  const sale = await createSale({
    admin: db.admin, source: "admin_payment_link", orderNumber: "GSW-BOX",
    pricing: "discounted_catalog", taxRate: 0, orderValues: {},
    lines: [
      { itemId: "clear", quantity: 1, packSize: 24, decrementInventory: true },
      { itemId: "clear", quantity: 1, packSize: 1, decrementInventory: true },
    ],
  });
  assert.equal(sale.total, 102.9);
  assert.deepEqual(db.savedItems.map((line) => line.base_units_per_sale), [24, 1]);
  assert.match(String(db.savedItems[0].name), /Box of 24/);
  assert.deepEqual(db.calls.filter((call) => call.name === "decrement_packaged_inventory").map((call) => call.args.p_pack_size), [24, 1]);
  await rollbackCreatedSale(db.admin, sale);
  assert.deepEqual(db.calls.filter((call) => call.name === "restock_packaged_inventory").map((call) => call.args.p_selling_qty), [1, 24]);
});

test("walk-in sales use the box price and 24-tube stock factor", async () => {
  const db = saleDatabase();
  const sale = await createSale({
    admin: db.admin, source: "walk_in", orderNumber: "GSW-POS",
    pricing: "explicit", taxRate: 0, orderValues: {},
    lines: [{ itemId: "clear", quantity: 2, packSize: 24, soldPrice: 98.4, decrementInventory: true }],
  });
  assert.equal(sale.total, 196.8);
  assert.equal(db.savedItems[0].base_units_per_sale, 24);
  assert.equal(db.calls[0].args.p_pack_size, 24);
});
