import { createClient } from "@/lib/supabase/client";
import type { Cart, CartItem, InventoryItem } from "@/types";

export async function getOrCreateCart(userId: string): Promise<string> {
  const sb = createClient();
  const { data: ex } = await sb.from("carts").select("id").eq("user_id", userId).single();
  if (ex) return ex.id;
  const { data, error } = await sb.from("carts").insert({ user_id: userId }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function fetchCart(userId: string): Promise<Cart | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("carts")
    .select("id,user_id,created_at,updated_at,cart_items(id,cart_id,item_id,name,sku,image_url,store_price,quantity)")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return { ...data, items: data.cart_items as CartItem[] };
}

export async function addToCart(userId: string, item: InventoryItem, qty = 1): Promise<void> {
  const sb = createClient();
  const cartId = await getOrCreateCart(userId);
  const { data: ex } = await sb.from("cart_items").select("id,quantity").eq("cart_id", cartId).eq("item_id", item.id).single();
  if (ex) {
    await sb.from("cart_items").update({ quantity: ex.quantity + qty }).eq("id", ex.id);
  } else {
    await sb.from("cart_items").insert({ cart_id: cartId, item_id: item.id, name: item.name, sku: item.sku, image_url: item.image_url, store_price: item.store_price, quantity: qty });
  }
  await sb.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
}

export async function updateCartItemQty(cartItemId: string, quantity: number): Promise<void> {
  const sb = createClient();
  if (quantity <= 0) { await sb.from("cart_items").delete().eq("id", cartItemId); }
  else { await sb.from("cart_items").update({ quantity }).eq("id", cartItemId); }
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  await createClient().from("cart_items").delete().eq("id", cartItemId);
}

export async function clearCart(cartId: string): Promise<void> {
  await createClient().from("cart_items").delete().eq("cart_id", cartId);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.store_price * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}
