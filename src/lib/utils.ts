import { createClient } from "@/lib/supabase/client";
import { clearCart, cartTotal } from "@/lib/cart";
import type { Cart, Order, StockStatus } from "@/types";

function genOrderNumber() {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,"");
  const r = Math.random().toString(36).toUpperCase().slice(2,6);
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

export async function getUserOrders(userId: string): Promise<Order[]> {
  const sb = createClient();
  const { data, error } = await sb.from("orders").select("*,order_items(*)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(o => ({ ...o, items: o.order_items as Order["items"] }));
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
  return ({ pending:"Pending", confirmed:"Confirmed", ready:"Ready for pickup", completed:"Completed", cancelled:"Cancelled" })[s] ?? s;
}
export function orderStatusColor(s: string) {
  return ({ pending:"#f59e0b", confirmed:"#0d6efd", ready:"#198754", completed:"#6c757d", cancelled:"#dc3545" })[s] ?? "#6c757d";
}
