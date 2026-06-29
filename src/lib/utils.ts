import { createClient } from "@/lib/supabase/client";
import { clearCart, cartTotal } from "@/lib/cart";
import type { Cart, Order, StockStatus } from "@/types";

function genOrderNumber() {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,"");
  // 6 chars from a padded random base-36 string — guaranteed length, ~2B combos/day
  const r = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
  return `GSW-${d}-${r}`;
}

export async function createOrder(userId: string, cart: Cart, notes = ""): Promise<Order> {
  const sb = createClient();
  const total = cartTotal(cart.items);
  const { data: order, error } = await sb.from("orders").insert({ order_number: genOrderNumber(), user_id: userId, status: "pending", total, notes }).select().single();
  if (error) throw new Error(error.message);
  const items = cart.items.map(ci => ({ order_id: order.id, item_id: ci.item_id, name: ci.name, sku: ci.sku, image_url: ci.image_url, unit_price: ci.store_price, quantity: ci.quantity }));
  await sb.from("order_items").insert(items);
  await clearCart(cart.id);
  return { ...order, items: items as Order["items"] };
}

export async function getUserOrders(userId: string, client?: any): Promise<Order[]> {
  const sb = client ?? createClient();
  const { data, error } = await sb.from("orders").select("*,order_items(*)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((o: any) => ({ ...o, items: o.order_items }));
}

// ── Format helpers ────────────────────────────────────────────────────────────

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

export function stockLabel(status: StockStatus, amount?: number): string {
  if (status === "out_of_stock") return "Out of Stock";
  if (status === "low_stock") return amount ? `Low Stock (${amount} left)` : "Low Stock";
  return "In Stock";
}

export function orderStatusLabel(s: string) {
  return ({ pending:"Pending", confirmed:"Confirmed", ready:"Ready for pickup", completed:"Completed", cancelled:"Cancelled", item_unavailable:"Item Unavailable" })[s] ?? s;
}
export function orderStatusColor(s: string) {
  return ({ pending:"#f59e0b", confirmed:"#0d6efd", ready:"#198754", completed:"#6c757d", cancelled:"#dc3545", item_unavailable:"#dc3545" })[s] ?? "#6c757d";
}

// ── Shop contact + customer-facing status messages ───────────────────────────

export const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE || "+1 253-449-6246";
export const SHOP_PHONE_RAW = (process.env.NEXT_PUBLIC_SHOP_PHONE || "+12534496246").replace(/[^+\d]/g, "");

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
        body: "Come collect it at our store counter. We look forward to seeing you!<br><br>📍 <strong>4204 Auburn Wy N Ste 8, Auburn, WA 98002</strong><br>📞 <strong>+1 253-449-6246</strong><br>✉️ <strong>orders@goldenstonetools.com</strong>",
        tone: "success",
      };
    case "completed":
      return {
        title: "Order complete",
        body: "Thanks for shopping with Golden Stone Tools.",
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
