import { createClient } from "@/lib/supabase/client";
import { clearCart, cartTotal } from "@/lib/cart";
import type { Cart, Order } from "@/types";

// Generates readable order number: GSW-20250626-A3F2
function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `GSW-${date}-${rand}`;
}

export async function createOrder(
  userId: string,
  cart: Cart,
  notes = ""
): Promise<Order> {
  const supabase = createClient();
  const total = cartTotal(cart.items);

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      user_id: userId,
      status: "pending",
      total,
      notes,
    })
    .select()
    .single();

  if (orderErr) throw new Error(orderErr.message);

  // Insert order items
  const orderItems = cart.items.map((ci) => ({
    order_id: order.id,
    item_id: ci.item_id,
    name: ci.name,
    sku: ci.sku,
    image_url: ci.image_url,
    unit_price: ci.store_price,
    quantity: ci.quantity,
  }));

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsErr) throw new Error(itemsErr.message);

  // Clear cart
  await clearCart(cart.id);

  return { ...order, items: orderItems as Order["items"] };
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      user_id,
      status,
      total,
      notes,
      created_at,
      updated_at,
      order_items (
        id,
        order_id,
        item_id,
        name,
        sku,
        image_url,
        unit_price,
        quantity
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((o) => ({
    ...o,
    items: o.order_items as Order["items"],
  }));
}
