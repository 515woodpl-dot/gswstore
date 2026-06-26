"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchCart, addToCart as addLib, updateCartItemQty, removeCartItem, cartCount, cartTotal } from "@/lib/cart";
import type { Cart, CartItem, InventoryItem } from "@/types";

interface Ctx {
  cart: Cart | null; itemCount: number; total: number; loading: boolean;
  addItem: (item: InventoryItem, qty?: number) => Promise<void>;
  updateQty: (id: string, qty: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}
const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const sb = createClient();

  const refresh = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setCart(null); setLoading(false); return; }
    const c = await fetchCart(user.id);
    setCart(c); setLoading(false);
  }, [sb]);

  useEffect(() => {
    refresh();
    const { data: { subscription } } = sb.auth.onAuthStateChange(() => refresh());
    return () => subscription.unsubscribe();
  }, [refresh, sb]);

  const addItem = useCallback(async (item: InventoryItem, qty = 1) => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error("Not signed in");
    await addLib(user.id, item, qty); await refresh();
  }, [sb, refresh]);

  const updateQty = useCallback(async (id: string, qty: number) => { await updateCartItemQty(id, qty); await refresh(); }, [refresh]);
  const removeItem = useCallback(async (id: string) => { await removeCartItem(id); await refresh(); }, [refresh]);

  const items: CartItem[] = cart?.items ?? [];
  return (
    <CartContext.Provider value={{ cart, itemCount: cartCount(items), total: cartTotal(items), loading, addItem, updateQty, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
