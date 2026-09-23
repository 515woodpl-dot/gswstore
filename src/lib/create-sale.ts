import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeOrder,
  toDollars,
  toSquareLinePlan,
  type ComputedOrder,
  type OrderDiscount,
  type SquareLinePlan,
} from "@/lib/order-money";

export type SaleSource = "online" | "walk_in" | "manual" | "admin_payment_link";

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  amount: number;
  store_price: number;
  sale_price: number | null;
  cost_price: number | null;
  units_per_sale: number | null;
}

interface SaleLineBase {
  itemId: string | null;
  quantity: number;
  decrementInventory: boolean;
  manualItemId?: string;
  name?: string;
  sku?: string;
}

export interface ExplicitSaleLine extends SaleLineBase {
  soldPrice: number;
  /** Omit to use the current catalog price (the walk-in flow). */
  listPrice?: number;
  /** Manual backfills preserve the staff-entered historical item label/SKU. */
  useProvidedMetadata?: boolean;
}

export interface DiscountedCatalogLine extends Omit<SaleLineBase, "itemId"> {
  itemId: string;
  lineDiscount?: number;
}

interface SaleOrder {
  id: string;
  order_number: string;
  [key: string]: unknown;
}

export interface CreatedSale {
  order: SaleOrder;
  items: Record<string, unknown>[];
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  total: number;
  squarePlan: { lines: SquareLinePlan[]; taxCents: number; totalCents: number };
  inventoryLines: { itemId: string; quantity: number }[];
}

export type SaleTotals = Pick<CreatedSale, "subtotal" | "discountTotal" | "taxAmount" | "total">;

interface CreateSaleBase {
  admin: SupabaseClient;
  source: SaleSource;
  orderNumber: string;
  orderValues: Record<string, unknown> | ((totals: SaleTotals) => Record<string, unknown>);
  taxRate: number;
  discountReason?: string;
}

export type CreateSaleInput = CreateSaleBase & (
  | { pricing: "explicit"; lines: ExplicitSaleLine[] }
  | { pricing: "discounted_catalog"; lines: DiscountedCatalogLine[]; orderDiscount?: OrderDiscount }
);

export class SaleCreationError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "SaleCreationError";
  }
}

function allocateTax(computed: ComputedOrder, netByItem: Map<string, number>, taxCents: number) {
  if (computed.lines.length === 0) return [];
  const shares = computed.lines.map((line) =>
    ((netByItem.get(line.itemId) ?? 0) * taxCents) / Math.max(1, computed.taxableCents),
  );
  const floors = shares.map(Math.floor);
  const remainder = taxCents - floors.reduce((sum, cents) => sum + cents, 0);
  const order = shares
    .map((share, index) => ({ index, fraction: share - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < remainder; index += 1) {
    floors[order[index % order.length].index] += 1;
  }
  return floors;
}

async function restock(
  admin: SupabaseClient,
  inventoryLines: { itemId: string; quantity: number }[],
) {
  for (const line of [...inventoryLines].reverse()) {
    const { error } = await admin.rpc("restock_packaged_inventory", {
      p_item_id: line.itemId,
      p_selling_qty: line.quantity,
    });
    if (error) console.error(`[Sale] inventory rollback failed for ${line.itemId}:`, error.message);
  }
}

export async function rollbackCreatedSale(admin: SupabaseClient, sale: CreatedSale) {
  const { error: deleteError } = await admin.from("orders").delete().eq("id", sale.order.id);
  if (deleteError) {
    console.error(`[Sale] order rollback failed for ${sale.order.id}:`, deleteError.message);
    return;
  }
  await restock(admin, sale.inventoryLines);
}

export async function createSale(input: CreateSaleInput): Promise<CreatedSale> {
  const { admin } = input;
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) {
    throw new SaleCreationError("Add between 1 and 100 products.", 400);
  }

  const catalogIds = [...new Set(input.lines.flatMap((line) => line.itemId ? [line.itemId] : []))];
  const { data: inventoryData, error: inventoryError } = catalogIds.length
    ? await admin
        .from("inventory")
        .select("id,name,sku,image_url,amount,store_price,sale_price,cost_price,units_per_sale")
        .in("id", catalogIds)
    : { data: [], error: null };
  if (inventoryError) throw new SaleCreationError("Could not verify inventory.");

  const inventoryById = new Map(
    ((inventoryData ?? []) as InventoryRow[]).map((item) => [item.id, item]),
  );
  if (inventoryById.size !== catalogIds.length) {
    throw new SaleCreationError("One or more products are no longer available.", 409);
  }

  const normalized = input.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) {
      throw new SaleCreationError("One or more sale quantities are invalid.", 400);
    }
    const item = line.itemId ? inventoryById.get(line.itemId)! : null;
    const itemId = item?.id || line.manualItemId?.trim() || `manual-${crypto.randomUUID().slice(0, 8)}`;
    const useProvidedMetadata = "useProvidedMetadata" in line && line.useProvidedMetadata;
    const name = (useProvidedMetadata ? line.name?.trim() : item?.name) || line.name?.trim() || "";
    if (!name) throw new SaleCreationError(`Item ${index + 1} needs a name.`, 400);
    return {
      input: line,
      item,
      itemId,
      pricingId: `${itemId}:${index}`,
      name,
      sku: (useProvidedMetadata ? line.sku?.trim() : item?.sku) || line.sku?.trim() || null,
      imageUrl: useProvidedMetadata ? null : item?.image_url ?? null,
      costPrice: Number(item?.cost_price) || 0,
      unitsPerSale: Math.max(1, Number(item?.units_per_sale) || 1),
      quantity,
    };
  });

  let computed: ComputedOrder;
  let discountTotalCents: number;
  let listPrices: number[];

  if (input.pricing === "discounted_catalog") {
    computed = computeOrder(
      normalized.map((line) => ({
        itemId: line.pricingId,
        quantity: line.quantity,
        listPrice: Number(line.item!.sale_price ?? line.item!.store_price),
        lineDiscount: Number((line.input as DiscountedCatalogLine).lineDiscount) || 0,
      })),
      input.orderDiscount,
      input.taxRate,
    );
    discountTotalCents = computed.discountTotalCents;
    listPrices = computed.lines.map((line) => line.listPrice);
  } else {
    listPrices = normalized.map((line) => {
      const explicit = line.input as ExplicitSaleLine;
      return explicit.listPrice == null
        ? Number(line.item!.sale_price ?? line.item!.store_price)
        : Number(explicit.listPrice);
    });
    if (listPrices.some((price) => !Number.isFinite(price) || price < 0 || price > 1_000_000)) {
      throw new SaleCreationError("One or more list prices are invalid.", 400);
    }
    const soldPrices = normalized.map((line) => Number((line.input as ExplicitSaleLine).soldPrice));
    computed = computeOrder(
      normalized.map((line, index) => ({
        itemId: line.pricingId,
        quantity: line.quantity,
        listPrice: soldPrices[index],
      })),
      undefined,
      input.taxRate,
    );
    discountTotalCents = normalized.reduce((sum, line, index) => {
      const listCents = Math.round(listPrices[index] * 100);
      const soldCents = Math.round(soldPrices[index] * 100);
      return sum + Math.max(0, listCents - soldCents) * line.quantity;
    }, 0);
  }

  if (discountTotalCents > 0 && !input.discountReason?.trim()) {
    throw new SaleCreationError("A discount was applied — please enter a reason.", 400);
  }

  const names = Object.fromEntries(normalized.map((line) => [line.pricingId, line.name]));
  const squarePlan = toSquareLinePlan(computed, names);
  const netByItem = new Map<string, number>();
  for (const line of squarePlan.lines) {
    netByItem.set(line.itemId, (netByItem.get(line.itemId) ?? 0) + line.lineTotalCents);
  }
  const taxShares = allocateTax(computed, netByItem, squarePlan.taxCents);
  const inventoryLines: { itemId: string; quantity: number }[] = [];
  let createdOrderId: string | null = null;

  try {
    for (const line of normalized.filter((candidate) => candidate.item && candidate.input.decrementInventory)) {
      const available = Math.floor(Number(line.item!.amount) / line.unitsPerSale);
      if (available < line.quantity) {
        throw new SaleCreationError(`${line.name} does not have enough stock (only ${available} available).`, 409);
      }
      const { error } = await admin.rpc("decrement_packaged_inventory", {
        p_item_id: line.itemId,
        p_selling_qty: line.quantity,
      });
      if (error) throw new SaleCreationError(`${line.name} changed while the sale was being completed. Please try again.`, 409);
      inventoryLines.push({ itemId: line.itemId, quantity: line.quantity });
    }

    const subtotal = toDollars(computed.subtotalCents);
    const discountTotal = toDollars(discountTotalCents);
    const taxAmount = toDollars(squarePlan.taxCents);
    const total = toDollars(squarePlan.totalCents);
    const totals = { subtotal, discountTotal, taxAmount, total };
    const orderValues = typeof input.orderValues === "function"
      ? input.orderValues(totals)
      : input.orderValues;
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        ...orderValues,
        order_number: input.orderNumber,
        source: input.source,
        subtotal,
        discount_total: discountTotal,
        tax_rate: input.taxRate,
        tax_total: taxAmount,
        total,
      })
      .select("*")
      .single();
    if (orderError || !order) throw new Error(orderError?.message || "Could not create the order.");
    createdOrderId = order.id;

    const itemRows = normalized.map((line, index) => {
      const netCents = netByItem.get(line.pricingId) ?? 0;
      const listCents = Math.round(listPrices[index] * 100) * line.quantity;
      return {
        order_id: order.id,
        item_id: line.itemId,
        name: line.name,
        sku: line.sku,
        image_url: line.imageUrl,
        unit_price: Math.round(netCents / line.quantity) / 100,
        net_amount: toDollars(netCents),
        list_price: listPrices[index],
        cost_price: line.costPrice,
        discount_amount: toDollars(Math.max(0, listCents - netCents)),
        discount_reason: listCents > netCents ? input.discountReason?.trim() || "" : "",
        tax_amount: toDollars(taxShares[index] ?? 0),
        quantity: line.quantity,
        base_units_per_sale: line.unitsPerSale,
        status: "active",
      };
    });
    const { data: items, error: itemsError } = await admin.from("order_items").insert(itemRows).select("*");
    if (itemsError) throw new Error("Could not save the sale items.");

    return {
      order: order as SaleOrder,
      items: (items ?? []) as Record<string, unknown>[],
      subtotal,
      discountTotal,
      taxAmount,
      total,
      squarePlan,
      inventoryLines,
    };
  } catch (error) {
    let canRestock = true;
    if (createdOrderId) {
      const { error: deleteError } = await admin.from("orders").delete().eq("id", createdOrderId);
      if (deleteError) {
        canRestock = false;
        console.error(`[Sale] order rollback failed for ${createdOrderId}:`, deleteError.message);
      }
    }
    if (canRestock) await restock(admin, inventoryLines);
    throw error;
  }
}
