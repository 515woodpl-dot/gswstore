"use client";

import { type FormEvent, type MouseEvent, useMemo, useRef, useState } from "react";

export interface StoreSearchProduct {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  category_name: string | null;
}

export default function StoreSearch({ products }: { products: StoreSearchProduct[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];

    return products
      .map((product) => {
        const searchable = [product.name, product.sku, product.brand, product.category_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const name = product.name.toLowerCase();
        const score = name.startsWith(term) ? 0 : name.includes(term) ? 1 : searchable.includes(term) ? 2 : 3;
        return { product, score };
      })
      .filter(({ score }) => score < 3)
      .sort((a, b) => a.score - b.score || a.product.name.localeCompare(b.product.name))
      .slice(0, 6)
      .map(({ product }) => product);
  }, [products, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    window.location.href = `/?${value ? `q=${encodeURIComponent(value)}&` : ""}#catalog`;
  }

  function focusSearch(event: MouseEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLButtonElement) return;
    inputRef.current?.focus();
  }

  return (
    <form
      action="/#catalog"
      method="get"
      role="search"
      onSubmit={submit}
      onClick={focusSearch}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      className="relative grid min-h-[62px] cursor-text grid-cols-[auto_1fr_auto] items-center gap-3 bg-white pl-4 focus-within:ring-0 sm:pl-6"
    >
      <span className="text-brand-blue" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" d="m16 16 5 5" /></svg>
      </span>
      <label className="sr-only" htmlFor="store-search">Search the catalog</label>
      <input
        ref={inputRef}
        id="store-search"
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Search by product, brand, or SKU"
        autoComplete="off"
        className="min-w-0 bg-transparent text-sm outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400"
      />
      <button type="submit" className="h-full bg-brand-blue px-4 text-[11px] font-black uppercase tracking-wide text-white outline-none transition hover:bg-brand-blue focus:bg-brand-blue focus:outline-none focus:ring-0 sm:px-6">
        Search<span className="hidden sm:inline"> catalog</span>
      </button>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 border border-t-0 border-slate-200 bg-white p-2 shadow-xl" role="listbox" aria-label="Search suggestions">
          {suggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { setQuery(product.name); setOpen(false); window.location.href = `/?q=${encodeURIComponent(product.name)}#catalog`; }}
              className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm text-brand-navy outline-none transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <span className="font-semibold">{product.name}</span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">{product.sku || product.category_name || "Product"}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
