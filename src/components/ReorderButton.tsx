"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addToCart } from "@/lib/cart";
import type { OrderItem } from "@/types";

export default function ReorderButton({ items, userId }: { items: OrderItem[]; userId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const sb = createClient();

  async function reorder() {
    setState("loading");
    try {
      // Fetch current inventory for each item to get live prices/stock.
      const ids = items.map((i) => i.item_id);
      const { data: inv } = await sb
        .from("inventory")
        .select("id,name,sku,image_url,store_price,sale_price,amount,category_name,brand,model_number,voltage,description,images,featured,new_arrival,attributes,tax_enabled,tax_rate_percent")
        .in("id", ids);

      if (!inv || inv.length === 0) { setState("error"); return; }

      // Add each item at its original quantity, mapped to current inventory data.
      await Promise.all(
        items.map((oi) => {
          const invItem = inv.find((i) => i.id === oi.item_id);
          if (!invItem || invItem.amount <= 0) return Promise.resolve();
          return addToCart(userId, invItem as any, oi.quantity);
        })
      );
      setState("done");
      // Reset after 3s
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={reorder}
      disabled={state === "loading"}
      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
        state === "done"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : state === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-navy hover:text-brand-navy"
      }`}
    >
      {state === "loading" ? "Adding…" : state === "done" ? "✓ Added to cart" : state === "error" ? "Some items unavailable" : "Reorder"}
    </button>
  );
}
