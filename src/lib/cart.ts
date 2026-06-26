import { createClient } from "@/lib/supabase/client";
import type { Cart, CartItem, InventoryItem } from "@/types";

// ── Get or create the current user's cart ────────────────────────────────────

export async function getOrCreateCart(userId: string): Promise<string> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id;
}

// ── Fetch cart with items ─────────────────────────────────────────────────────

export async function fetchCart(userId: string): Promise<Cart | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("carts")
    .select(`
      id,
      user_id,
      created_at,
      updated_at,
      cart_items (
        id,
        cart_id,
        item_id,
        name,
        sku,
        image_url,
        store_price,
        quantity
      )
    `)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    items: data.cart_items as CartItem[],
  };
}

// ── Add item to cart ──────────────────────────────────────────────────────────

export async function addToCart(
  userId: string,
  item: InventoryItem,
  qty = 1
): Promise<void> {
  const supabase = createClient();
  const cartId = await getOrCreateCart(userId);

  // Check if item already in cart
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("item_id", item.id)
    .single();

  if (existing) {
    await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + qty })
      .eq("id", existing.id);
  } else {
    await supabase.from("cart_items").insert({
      cart_id: cartId,
      item_id: item.id,
      name: item.name,
      sku: item.sku,
      image_url: item.image_url,
      store_price: item.store_price,
      quantity: qty,
    });
  }

  // Touch cart updated_at
  await supabase
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);
}

// ── Update quantity ───────────────────────────────────────────────────────────

export async function updateCartItemQty(
  cartItemId: string,
  quantity: number
): Promise<void> {
  const supabase = createClient();

  if (quantity <= 0) {
    await supabase.from("cart_items").delete().eq("id", cartItemId);
  } else {
    await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", cartItemId);
  }
}

// ── Remove item ───────────────────────────────────────────────────────────────

export async function removeCartItem(cartItemId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("cart_items").delete().eq("id", cartItemId);
}

// ── Clear cart ────────────────────────────────────────────────────────────────

export async function clearCart(cartId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
}

// ── Cart totals ───────────────────────────────────────────────────────────────

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.store_price * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
