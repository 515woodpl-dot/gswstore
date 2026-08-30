import { createClient } from "@/lib/supabase/client";
import { clearCart, cartTotal } from "@/lib/cart";
import type { Cart, Order, StockStatus } from "@/types";
import { BRAND } from "@/lib/brand";

function genOrderNumber() {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,"");
  // 6 chars from a padded random base-36 string — guaranteed length, ~2B combos/day
  const r = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
  return `GSS-${d}-${r}`;
}

export async function createOrder(
  userId: string,
  cart: Cart,
  notes = "",
  fulfillment: "pickup" | "delivery" = "pickup",
  deliveryAddress = "",
  promo?: { code: string; percentOff: number }
): Promise<Order> {
  const sb = createClient();
  const percentOff = Math.min(100, Math.max(0, Number(promo?.percentOff) || 0));
  const total = Math.round(cartTotal(cart.items) * (1 - percentOff / 100) * 100) / 100;
  const { data: order, error } = await sb.from("orders").insert({
    order_number: genOrderNumber(),
    user_id: userId,
    status: "pending",
    total,
    notes,
    fulfillment,
    delivery_address: fulfillment === "delivery" ? deliveryAddress : "",
    promo_code: promo?.code || "",
    promo_percent: percentOff,
  }).select().single();
  if (error) throw new Error(error.message);
  const items = cart.items.map(ci => {
    const base = ci.sale_price ?? ci.store_price;
    const unitPrice = Math.round(base * (1 - percentOff / 100) * 100) / 100;
    return { order_id: order.id, item_id: ci.item_id, name: ci.name, sku: ci.sku, image_url: ci.image_url, unit_price: unitPrice, list_price: ci.store_price, cost_price: 0, discount_amount: Math.round((ci.store_price - unitPrice) * ci.quantity * 100) / 100, discount_reason: promo?.code ? `Code: ${promo.code}` : "", quantity: ci.quantity };
  });
  await sb.from("order_items").insert(items);

  // Decrement inventory stock for each purchased item (atomic via RPC).
  await Promise.all(
    cart.items.map(ci =>
      sb.rpc("decrement_inventory", { p_item_id: ci.item_id, p_qty: ci.quantity })
    )
  );

  await clearCart(cart.id);
  return { ...order, items: items as unknown as Order["items"] };
}

export async function getUserOrders(userId: string, client?: any): Promise<Order[]> {
  const sb = client ?? createClient();
  const { data, error } = await sb.from("orders").select("*,order_items(*)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((o: any) => ({ ...o, items: o.order_items }));
}

// ── Tax rate lookup ───────────────────────────────────────────────────────────
export async function getTaxRateForZip(zip: string): Promise<number> {
  try {
    const res = await fetch(`/api/admin/tax-rates?zip=${zip}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.combined_rate ?? 0;
  } catch {
    return 0;
  }
}


export function formatPrice(val: number | null | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function stockColor(status: StockStatus): string {
  if (status === "out_of_stock") return "#dc3545";
  if (status === "low_stock") return "#f59e0b";
  return "#198754";
}

// ── Tax helpers ──────────────────────────────────────────────────────────────
// Tax is controlled per-item from the inventory admin panel via
// `tax_enabled` (on/off) and `tax_rate_percent` (e.g. 8.5).

export interface PriceBreakdown {
  base: number;       // pre-tax price (sale price if on sale, else store price)
  taxRate: number;    // percent, 0 when tax disabled
  taxAmount: number;  // currency amount of tax
  total: number;      // base + taxAmount
  taxed: boolean;     // whether tax was applied
}

export function priceBreakdown(opts: {
  store_price: number;
  sale_price?: number | null;
  tax_enabled?: boolean;
  tax_rate_percent?: number;
}): PriceBreakdown {
  const base = opts.sale_price != null ? Number(opts.sale_price) : Number(opts.store_price);
  const taxed = !!opts.tax_enabled && Number(opts.tax_rate_percent) > 0;
  const taxRate = taxed ? Number(opts.tax_rate_percent) : 0;
  const taxAmount = taxed ? Math.round(base * taxRate) / 100 : 0;
  return { base, taxRate, taxAmount, total: base + taxAmount, taxed };
}

export function stockLabel(status: StockStatus, amount?: number): string {
  if (status === "out_of_stock") return "Out of Stock";
  if (status === "low_stock") return "Low Stock";
  return "In Stock";
}

export function orderStatusLabel(s: string) {
  return ({ pending:"Pending", confirmed:"Confirmed", ready:"Ready for pickup", completed:"Completed", cancelled:"Cancelled", item_unavailable:"Item Unavailable" })[s] ?? s;
}
export function orderStatusColor(s: string) {
  return ({ pending:"#f59e0b", confirmed:"#0d6efd", ready:"#198754", completed:"#6c757d", cancelled:"#dc3545", item_unavailable:"#dc3545" })[s] ?? "#6c757d";
}

// ── Shop contact + customer-facing status messages ───────────────────────────

export const SHOP_PHONE = BRAND.phone;
export const SHOP_PHONE_RAW = BRAND.phoneRaw;

export interface CustomerStatusMessage {
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "muted";
}

export function customerStatusMessage(status: string, attentionNote?: string): CustomerStatusMessage {
  switch (status) {
    case "pending":
    case "confirmed":
      return {
        title: "We've got your order",
        body: "Thanks! We're working on it now and will let you know as soon as it's ready for pickup.",
        tone: "info",
      };
    case "ready":
      return {
        title: "Your order is ready for pickup!",
        body: `Come collect it at our store counter. We look forward to seeing you!<br><br>📍 <strong>${BRAND.address}</strong><br>📞 <strong>${BRAND.phone}</strong><br>✉️ <strong>${BRAND.orderEmail}</strong>`,
        tone: "success",
      };
    case "completed":
      return {
        title: "Order complete",
        body: `Thanks for shopping with ${BRAND.name}.`,
        tone: "muted",
      };
    case "cancelled":
      return {
        title: "Order cancelled",
        body: `If you have questions, call us at ${SHOP_PHONE}.`,
        tone: "muted",
      };
    case "item_unavailable":
      return {
        title: "There's an issue with an item",
        body: (attentionNote && attentionNote.trim())
          ? `${attentionNote.trim()} We'll call you soon — or reach us at ${SHOP_PHONE}.`
          : `One of your items is currently unavailable. We'll call you soon — or reach us at ${SHOP_PHONE}.`,
        tone: "warning",
      };
    default:
      return { title: "Order received", body: "We're processing your order.", tone: "info" };
  }
}

export function deriveStockStatus(amount: number): StockStatus {
  if (amount <= 0) return "out_of_stock";
  if (amount < 10) return "low_stock";
  return "in_stock";
}
