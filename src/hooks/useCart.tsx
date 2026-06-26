"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCart,
  addToCart as addToCartLib,
  updateCartItemQty,
  removeCartItem,
  cartCount,
  cartTotal,
} from "@/lib/cart";
import type { Cart, CartItem, InventoryItem } from "@/types";

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  total: number;
  loading: boolean;
  addItem: (item: InventoryItem, qty?: number) => Promise<void>;
  updateQty: (cartItemId: string, qty: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCart(null);
      setLoading(false);
      return;
    }

    const c = await fetchCart(user.id);
    setCart(c);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh, supabase]);

  const addItem = useCallback(
    async (item: InventoryItem, qty = 1) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await addToCartLib(user.id, item, qty);
      await refresh();
    },
    [supabase, refresh]
  );

  const updateQty = useCallback(
    async (cartItemId: string, qty: number) => {
      await updateCartItemQty(cartItemId, qty);
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      await removeCartItem(cartItemId);
      await refresh();
    },
    [refresh]
  );

  const items: CartItem[] = cart?.items ?? [];

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount: cartCount(items),
        total: cartTotal(items),
        loading,
        addItem,
        updateQty,
        removeItem,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
