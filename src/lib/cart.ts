import { createClient } from "@/lib/supabase/client";
import type { Cart, CartItem, InventoryItem } from "@/types";
import { resolveSalePackage } from "@/lib/packaging";

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
    .select("id,user_id,created_at,updated_at,cart_items(id,cart_id,item_id,name,sku,image_url,store_price,sale_price,quantity,base_unit,selling_unit,units_per_sale)")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return { ...data, items: data.cart_items as CartItem[] };
}

export async function addToCart(userId: string, item: InventoryItem, qty = 1): Promise<void> {
  const sb = createClient();
  const cartId = await getOrCreateCart(userId);
  const packSize = item.units_per_sale ?? 1;
  if (!Number.isInteger(qty) || qty < 1) throw new Error("Choose a valid quantity.");
  const [{ data: product, error: productError }, { data: cartLines, error: linesError }] = await Promise.all([
    sb.from("inventory").select("amount,units_per_sale,box_enabled,box_price,store_price,sale_price").eq("id", item.id).single(),
    sb.from("cart_items").select("id,quantity,units_per_sale").eq("cart_id", cartId).eq("item_id", item.id),
  ]);
  if (productError || !product) throw new Error("Could not verify current stock.");
  if (linesError || !cartLines) throw new Error("Could not verify cart quantities.");
  const packageOption = resolveSalePackage(product, packSize);
  if (!packageOption) throw new Error("This package is no longer available.");
  const usedUnits = cartLines.reduce((sum, line) => sum + line.quantity * line.units_per_sale, 0);
  if (usedUnits + qty * packSize > product.amount) throw new Error("Not enough stock for this quantity.");
  const ex = cartLines.find((line) => line.units_per_sale === packSize);
  const storePrice = Number(packageOption.isBox ? packageOption.price : product.store_price);
  if (!Number.isFinite(storePrice) || storePrice < 0 || (packageOption.isBox && storePrice === 0)) throw new Error("This package is not available for sale.");
  const salePrice = packageOption.isBox ? null : product.sale_price;
  if (ex) {
    const { error } = await sb.from("cart_items").update({ quantity: ex.quantity + qty, store_price: storePrice, sale_price: salePrice }).eq("id", ex.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("cart_items").insert({ cart_id: cartId, item_id: item.id, name: item.name, sku: item.sku, image_url: item.image_url, store_price: storePrice, sale_price: salePrice, quantity: qty, base_unit: item.base_unit ?? "Each", selling_unit: packageOption.isBox ? "Box" : item.selling_unit ?? "Each", units_per_sale: packSize });
    if (error) throw new Error(error.message);
  }
  await sb.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
}

export async function updateCartItemQty(cartItemId: string, quantity: number): Promise<void> {
  const sb = createClient();
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a valid quantity.");
  const { data: line, error: lineError } = await sb.from("cart_items").select("cart_id,item_id,units_per_sale").eq("id", cartItemId).single();
  if (lineError || !line) throw new Error("Cart item no longer exists.");
  const [{ data: product, error: productError }, { data: cartLines, error: linesError }] = await Promise.all([
    sb.from("inventory").select("amount").eq("id", line.item_id).single(),
    sb.from("cart_items").select("id,quantity,units_per_sale").eq("cart_id", line.cart_id).eq("item_id", line.item_id),
  ]);
  if (productError || !product || linesError || !cartLines) throw new Error("Could not verify current stock.");
  const usedUnits = cartLines.reduce((sum, entry) => sum + (entry.id === cartItemId ? quantity : entry.quantity) * entry.units_per_sale, 0);
  if (usedUnits > product.amount) throw new Error("Not enough stock for this quantity.");
  const { error } = await sb.from("cart_items").update({ quantity }).eq("id", cartItemId);
  if (error) throw new Error(error.message);
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  await createClient().from("cart_items").delete().eq("id", cartItemId);
}

export async function clearCart(cartId: string): Promise<void> {
  await createClient().from("cart_items").delete().eq("cart_id", cartId);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + (i.sale_price ?? i.store_price) * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}
