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
    <div className="space-y-5">
      {/* Variant radio cards */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">
          <span className="text-brand-primary">*</span>{dimension}
        </p>
        <div className="space-y-2">
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
                  "flex w-full items-start justify-between gap-4 rounded-xl border p-3 text-left transition",
                  isSel ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-slate-200 bg-white hover:border-slate-300",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                    isSel ? "border-brand-navy" : "border-slate-300",
                  ].join(" ")}>
                    {isSel && <span className="h-2.5 w-2.5 rounded-full bg-brand-navy" />}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{v.variant_label || v.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {v.sku && <><span className="font-semibold">SKU:</span> {v.sku}</>}
                      {v.sku && v.part_number && <span className="mx-1.5">·</span>}
                      {v.part_number && <><span className="font-semibold">Part #:</span> {v.part_number}</>}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-slate-900">{formatPrice(price)}</p>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{selected.variant_label}</p>
            {selected.sale_price ? (
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-black text-brand-primary">{formatPrice(selected.sale_price)}</p>
                <p className="text-base font-semibold text-slate-400 line-through">{formatPrice(selected.store_price)}</p>
              </div>
            ) : (
              <p className="mt-1 text-2xl font-black text-slate-950">{formatPrice(selected.store_price)}</p>
            )}
          </div>
        </div>
        <AddToCartButton key={selected.id} item={selectedForCart} />
      </div>
    </div>
  );
}
