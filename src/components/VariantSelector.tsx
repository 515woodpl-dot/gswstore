"use client";

import { useState } from "react";
import { formatPrice, deriveStockStatus } from "@/lib/utils";
import AddToCartButton from "@/components/AddToCartButton";
import type { InventoryItem } from "@/types";

export default function VariantSelector({ product }: { product: InventoryItem }) {
  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;

  // Default to first in-stock variant, else first
  const firstAvailable = variants.find((v) => v.amount > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string>(firstAvailable?.id ?? "");

  if (!hasVariants) {
    // No variants — behave like a normal product
    return <AddToCartButton item={product} />;
  }

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const dimension = variants[0].variant_dimension || "Option";

  // The variant carries its own price/stock but inherits image + name context.
  const selectedForCart: InventoryItem = {
    ...selected,
    name: `${product.name} — ${selected.variant_label}`,
    image_url: selected.image_url || product.image_url,
    stock_status: deriveStockStatus(selected.amount),
  };

  return (
    <div className="space-y-6 border-y border-slate-300 py-6">
      {/* Variant radio cards */}
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-brand-navy">
          <span className="text-brand-primary">*</span>{dimension}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((v) => {
            const isSel = v.id === selectedId;
            const out = v.amount <= 0;
            const price = v.sale_price ?? v.store_price;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={[
                  "flex w-full items-start justify-between gap-4 border p-3 text-left transition",
                  isSel ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white hover:border-brand-blue",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                    isSel ? "border-brand-gold" : "border-slate-300",
                  ].join(" ")}>
                    {isSel && <span className="h-2.5 w-2.5 rounded-full bg-brand-gold" />}
                  </span>
                  <div>
                    <p className={`font-display font-black uppercase ${isSel ? "text-white" : "text-brand-navy"}`}>{v.variant_label || v.name}</p>
                    <p className={`mt-0.5 text-[9px] ${isSel ? "text-white/55" : "text-slate-500"}`}>
                      {v.sku && <><span className="font-semibold">SKU:</span> {v.sku}</>}
                      {v.sku && v.part_number && <span className="mx-1.5">·</span>}
                      {v.part_number && <><span className="font-semibold">Part #:</span> {v.part_number}</>}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-display font-black ${isSel ? "text-white" : "text-brand-navy"}`}>
                    {formatPrice(price)}
                    {v.sale_price != null && v.sale_price < v.store_price && (
                      <span className="ml-1.5 text-xs font-semibold text-slate-400 line-through">{formatPrice(v.store_price)}</span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-xs italic ${out ? "text-slate-400" : v.amount < 10 ? "text-amber-600" : "text-emerald-600"}`}>
                    {out ? "On order. Ships when back in stock" : v.amount < 10 ? "Low stock" : "In stock"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected variant price + add to cart */}
      <div className="border border-slate-300 bg-white p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{selected.variant_label}</p>
            {selected.sale_price ? (
              <div className="mt-1 flex items-baseline gap-2">
                <p className="font-display text-3xl font-black text-brand-gold">{formatPrice(selected.sale_price)}</p>
                <p className="text-base font-semibold text-slate-400 line-through">{formatPrice(selected.store_price)}</p>
              </div>
            ) : (
              <p className="font-display mt-1 text-3xl font-black text-brand-navy">{formatPrice(selected.store_price)}</p>
            )}
          </div>
        </div>
        <AddToCartButton key={selected.id} item={selectedForCart} />
      </div>
    </div>
  );
}
