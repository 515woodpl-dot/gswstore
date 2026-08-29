"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import {
  calculateLandedCosts,
  weightedAverageCost,
  type AllocationMode,
  type ExpenseKind,
  type LandedCostExpense,
} from "@/lib/landedCost";
import { generateSmartProductIdentity, inferCategoryFromProductName } from "@/lib/productIdentity";
import type { Category } from "@/types";

interface PendingNewProduct {
  categoryId: number;
  categoryName: string;
  storePrice: number;
  storeVisible: boolean;
}

interface ReceivingProduct {
  id: string;
  name: string;
  original_name: string;
  sku: string | null;
  amount: number;
  cost_price: number;
  store_price: number;
  pendingNew?: PendingNewProduct;
}

interface NewProductDraft {
  id: string;
  sku: string;
  name: string;
  originalName: string;
  categoryId: number | null;
  storePrice: number;
  supplierUnitCost: number;
  quantity: number;
  unitWeight: number;
  storeVisible: boolean;
  smartIdentity: boolean;
}

interface ReceiptLine {
  id: string;
  quantity: number;
  supplierUnitCost: number;
  unitWeight: number;
  manualAllocation: number;
}

interface RecentReceiptItem {
  id: string;
  inventory_id: string;
  original_name_snapshot: string;
  quantity_received: number;
  remaining_quantity: number;
  landed_unit_cost: number;
}

interface RecentReceipt {
  id: string;
  receipt_code: string;
  supplier_name: string;
  supplier_invoice: string;
  received_date: string;
  shared_expenses: number;
  landed_total: number;
  inventory_receipt_items: RecentReceiptItem[];
}

interface SavedReceipt {
  batchCode: string;
  supplier: string;
  receivedDate: string;
  lines: Array<{
    inventoryId: string;
    name: string;
    originalName: string;
    sku: string;
    quantity: number;
    landedUnitCost: number;
  }>;
}

const EXPENSE_FIELDS: Array<{ kind: ExpenseKind; label: string; hint: string }> = [
  { kind: "freight", label: "Freight / delivery", hint: "By weight when all weights are entered; otherwise by item value" },
  { kind: "tariff", label: "Tariffs / duties", hint: "Allocated by item purchase value" },
  { kind: "tax", label: "Import tax / fees", hint: "Allocated by item purchase value" },
  { kind: "handling", label: "Handling", hint: "Allocated by quantity" },
  { kind: "other", label: "Other shared expense", hint: "Allocated by item purchase value" },
];

const emptyExpenses = (): Record<ExpenseKind, number> => ({
  freight: 0,
  tariff: 0,
  tax: 0,
  handling: 0,
  other: 0,
});

function makeBatchCode(date: string) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, "0");
  return `RCV-${date.replaceAll("-", "")}-${suffix}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceivingManager({
  initialProducts,
  categories,
  recentReceipts,
  setupError,
}: {
  initialProducts: ReceivingProduct[];
  categories: Category[];
  recentReceipts: RecentReceipt[];
  setupError?: string;
}) {
  const router = useRouter();
  const sb = createClient();
  const initialDate = today();
  const [products, setProducts] = useState(initialProducts);
  const [receiptCode, setReceiptCode] = useState(() => makeBatchCode(initialDate));
  const [supplier, setSupplier] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [receivedDate, setReceivedDate] = useState(initialDate);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [expenses, setExpenses] = useState<Record<ExpenseKind, number>>(emptyExpenses);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("automatic");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductDraft | null>(null);
  const [newProductError, setNewProductError] = useState("");
  const [correctingReceipt, setCorrectingReceipt] = useState<RecentReceipt | null>(null);
  const [correctionType, setCorrectionType] = useState<ExpenseKind>("freight");
  const [correctionLabel, setCorrectionLabel] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState(0);
  const [correctionError, setCorrectionError] = useState("");
  const [correcting, setCorrecting] = useState(false);

  const activeExpenses: LandedCostExpense[] = EXPENSE_FIELDS.map((field) => ({
    kind: field.kind,
    label: field.label,
    amount: Number(expenses[field.kind]) || 0,
  })).filter((expense) => expense.amount > 0);

  const calculation = useMemo(() => calculateLandedCosts(lines, activeExpenses, allocationMode), [
    lines,
    activeExpenses,
    allocationMode,
  ]);

  const forecast = useMemo(() => {
    let potentialRevenue = 0;
    let potentialProfit = 0;
    let missingPriceCount = 0;
    for (const line of calculation.lines) {
      const product = products.find((candidate) => candidate.id === line.id);
      const customerPrice = product?.pendingNew?.storePrice ?? Number(product?.store_price) ?? 0;
      const landedTotal = line.landedUnitCost * line.quantity;
      if (customerPrice <= 0) {
        missingPriceCount += 1;
        continue;
      }
      potentialRevenue += customerPrice * line.quantity;
      potentialProfit += customerPrice * line.quantity - landedTotal;
    }
    const margin = potentialRevenue > 0 ? (potentialProfit / potentialRevenue) * 100 : 0;
    return { potentialRevenue, potentialProfit, margin, missingPriceCount };
  }, [calculation.lines, products]);

  const availableProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(lines.map((line) => line.id));
    return products.filter((product) =>
      !selected.has(product.id) &&
      [product.name, product.original_name, product.id, product.sku ?? ""].join(" ").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [lines, products, query]);

  function productFor(id: string) {
    return products.find((product) => product.id === id);
  }

  function identityForNewProduct(name: string, categoryId: number | null) {
    const inferred = inferCategoryFromProductName(name, categories);
    const category = inferred ?? categories.find((candidate) => candidate.id === categoryId) ?? null;
    if (!category) return { category: null, id: "", sku: "" };
    const identity = generateSmartProductIdentity(category, products);
    return { category, id: identity.id, sku: identity.sku };
  }

  function openNewProduct() {
    const startingName = query.trim();
    const identity = identityForNewProduct(startingName, null);
    setNewProduct({
      id: identity.id,
      sku: identity.sku,
      name: startingName,
      originalName: startingName,
      categoryId: identity.category?.id ?? null,
      storePrice: 0,
      supplierUnitCost: 0,
      quantity: 1,
      unitWeight: 0,
      storeVisible: false,
      smartIdentity: true,
    });
    setNewProductError(categories.length === 0 ? "Create at least one category before creating a product." : "");
  }

  function updateNewProductName(name: string) {
    setNewProduct((current) => {
      if (!current) return current;
      if (!current.smartIdentity) return { ...current, name };
      const identity = identityForNewProduct(name, current.categoryId);
      return {
        ...current,
        name,
        categoryId: identity.category?.id ?? current.categoryId,
        id: identity.id || current.id,
        sku: identity.sku || current.sku,
      };
    });
  }

  function updateNewProductCategory(categoryId: number | null) {
    setNewProduct((current) => {
      if (!current) return current;
      if (!current.smartIdentity) return { ...current, categoryId };
      const identity = identityForNewProduct(current.name, categoryId);
      return { ...current, categoryId, id: identity.id, sku: identity.sku };
    });
  }

  function forceNewProductIdentity() {
    setNewProduct((current) => {
      if (!current) return current;
      const identity = identityForNewProduct(current.name, current.categoryId);
      return {
        ...current,
        smartIdentity: true,
        categoryId: identity.category?.id ?? current.categoryId,
        id: identity.id,
        sku: identity.sku,
      };
    });
  }

  function queueNewProduct() {
    if (!newProduct) return;
    setNewProductError("");
    const id = newProduct.id.trim().toUpperCase();
    const sku = newProduct.sku.trim().toUpperCase();
    const category = categories.find((candidate) => candidate.id === newProduct.categoryId);
    if (!newProduct.name.trim()) { setNewProductError("Enter the new customer-facing store name."); return; }
    if (!newProduct.originalName.trim()) { setNewProductError("Enter the original name from the supplier."); return; }
    if (!category) { setNewProductError("Select a category."); return; }
    if (!id) { setNewProductError("Generate or enter a product ID."); return; }
    if (products.some((product) => product.id.toUpperCase() === id)) { setNewProductError(`Product ID ${id} already exists.`); return; }
    if (sku && products.some((product) => product.sku?.toUpperCase() === sku)) { setNewProductError(`SKU ${sku} already exists.`); return; }
    if (newProduct.quantity <= 0 || !Number.isInteger(newProduct.quantity)) { setNewProductError("Received quantity must be a whole number greater than zero."); return; }
    if (newProduct.supplierUnitCost < 0) { setNewProductError("Supplier cost cannot be negative."); return; }
    if (newProduct.storePrice <= 0) {
      setNewProductError("Enter a customer selling price greater than $0.00. Supplier cost and landed cost are internal and do not set the store price.");
      return;
    }

    const product: ReceivingProduct = {
      id,
      sku: sku || id,
      name: newProduct.name.trim(),
      original_name: newProduct.originalName.trim(),
      amount: 0,
      cost_price: 0,
      store_price: newProduct.storePrice,
      pendingNew: {
        categoryId: category.id,
        categoryName: category.name,
        storePrice: newProduct.storePrice,
        storeVisible: newProduct.storeVisible,
      },
    };
    setProducts((current) => [...current, product]);
    setLines((current) => [...current, {
      id,
      quantity: newProduct.quantity,
      supplierUnitCost: newProduct.supplierUnitCost,
      unitWeight: newProduct.unitWeight,
      manualAllocation: 0,
    }]);
    setNewProduct(null);
    setQuery("");
  }

  function addProduct(product: ReceivingProduct) {
    setLines((current) => [...current, {
      id: product.id,
      quantity: 1,
      supplierUnitCost: Number(product.cost_price) || 0,
      unitWeight: 0,
      manualAllocation: 0,
    }]);
    setQuery("");
  }

  function updateLine(id: string, patch: Partial<ReceiptLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
    setProducts((current) => current.filter((product) => product.id !== id || !product.pendingNew));
  }

  function resetForm() {
    const nextDate = today();
    setReceiptCode(makeBatchCode(nextDate));
    setSupplier("");
    setSupplierInvoice("");
    setReceivedDate(nextDate);
    setNotes("");
    setLines([]);
    setProducts((current) => current.filter((product) => !product.pendingNew));
    setExpenses(emptyExpenses());
    setAllocationMode("automatic");
    setError("");
    setSavedReceipt(null);
  }

  async function addMissedExpense() {
    if (!correctingReceipt) return;
    if (correctionAmount <= 0) { setCorrectionError("Enter an expense greater than $0.00."); return; }
    setCorrecting(true); setCorrectionError("");
    try {
      const { error: rpcError } = await sb.rpc("add_receipt_expense_correction", {
        p_receipt_id: correctingReceipt.id,
        p_expense_type: correctionType,
        p_label: correctionLabel.trim(),
        p_amount: correctionAmount,
      });
      if (rpcError) throw new Error(rpcError.message);
      setCorrectingReceipt(null); setCorrectionLabel(""); setCorrectionAmount(0);
      router.refresh();
    } catch (caught) {
      setCorrectionError(caught instanceof Error ? caught.message : "Could not add the receipt expense.");
    } finally {
      setCorrecting(false);
    }
  }

  async function receiveStock() {
    setError("");
    if (setupError) {
      setError("Run MIGRATION_INVENTORY_RECEIVING.sql in Supabase before receiving stock.");
      return;
    }
    if (!receiptCode.trim()) { setError("The batch token is required."); return; }
    if (!supplier.trim()) { setError("Enter the supplier so this shipment can be identified later."); return; }
    if (lines.length === 0) { setError("Add at least one product to this receipt."); return; }
    if (lines.some((line) => line.quantity <= 0)) { setError("Every received quantity must be greater than zero."); return; }
    if (lines.some((line) => line.supplierUnitCost < 0)) { setError("Supplier prices cannot be negative."); return; }
    if (allocationMode === "manual" && Math.abs(calculation.manualDifference) >= 0.01) {
      setError(`Manual allocations must match shared expenses. ${formatPrice(Math.abs(calculation.manualDifference))} is still ${calculation.manualDifference > 0 ? "unallocated" : "over-allocated"}.`);
      return;
    }

    setSaving(true);
    try {
      const { data, error: rpcError } = await sb.rpc("receive_inventory_batch", {
        p_receipt_code: receiptCode.trim(),
        p_supplier_name: supplier.trim(),
        p_supplier_invoice: supplierInvoice.trim(),
        p_received_date: receivedDate,
        p_notes: notes.trim(),
        p_allocation_mode: allocationMode,
        p_expenses: activeExpenses.map((expense) => ({
          type: expense.kind,
          label: expense.label,
          amount: expense.amount,
        })),
        p_items: calculation.lines.map((line) => ({
          ...(productFor(line.id)?.pendingNew ? {
            new_product: {
              name: productFor(line.id)?.name,
              original_name: productFor(line.id)?.original_name,
              sku: productFor(line.id)?.sku,
              category_id: productFor(line.id)?.pendingNew?.categoryId,
              store_price: productFor(line.id)?.pendingNew?.storePrice,
              store_visible: productFor(line.id)?.pendingNew?.storeVisible,
            },
          } : {}),
          inventory_id: line.id,
          quantity: line.quantity,
          supplier_unit_cost: line.supplierUnitCost,
          unit_weight: line.unitWeight,
          manual_allocated_expense: line.manualAllocation,
        })),
      });
      if (rpcError) throw new Error(rpcError.message);

      const returned = Array.isArray(data) ? data[0] : data;
      const confirmedCode = returned?.batch_code ?? receiptCode.trim();
      const confirmationLines = calculation.lines.map((line) => {
        const product = productFor(line.id);
        return {
          inventoryId: line.id,
          name: product?.name ?? line.id,
          originalName: product?.original_name ?? product?.name ?? line.id,
          sku: product?.sku ?? "",
          quantity: line.quantity,
          landedUnitCost: line.landedUnitCost,
        };
      });

      setProducts((current) => current.map((product) => {
        const received = calculation.lines.find((line) => line.id === product.id);
        if (!received) return product;
        return {
          ...product,
          pendingNew: undefined,
          amount: product.amount + received.quantity,
          cost_price: weightedAverageCost(
            product.amount,
            product.cost_price,
            received.quantity,
            received.landedUnitCost,
          ),
        };
      }));
      setSavedReceipt({
        batchCode: confirmedCode,
        supplier: supplier.trim(),
        receivedDate,
        lines: confirmationLines,
      });
      fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not receive this shipment.");
    } finally {
      setSaving(false);
    }
  }

  if (savedReceipt) {
    return (
      <>
        <div className="mx-auto max-w-3xl print:hidden">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Shipment received</p>
            <h2 className="mt-2 font-mono text-2xl font-black text-slate-950 sm:text-3xl">{savedReceipt.batchCode}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {savedReceipt.lines.reduce((sum, line) => sum + line.quantity, 0)} units were added to inventory with their new weighted-average costs.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button onClick={() => window.print()} className="rounded-xl bg-brand-navy px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
                Print batch tags
              </button>
              <button onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Receive another shipment
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {savedReceipt.lines.map((line) => (
              <div key={line.inventoryId} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{line.name}</p>
                  {line.originalName !== line.name && <p className="truncate text-xs text-slate-500">Original: {line.originalName}</p>}
                  <p className="text-xs text-slate-500">{line.sku || line.inventoryId} · Qty {line.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Landed cost each</p>
                  <p className="font-mono text-sm font-black text-slate-900">{formatPrice(line.landedUnitCost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="batch-tags" className="hidden">
          {savedReceipt.lines.map((line) => (
            <div key={line.inventoryId} className="batch-tag">
              <p className="tag-brand">GOLDEN STONE SUPPLY · RECEIVING</p>
              <p className="tag-code">{savedReceipt.batchCode}</p>
              <p className="tag-name">{line.name}</p>
              <div className="tag-grid">
                <span>SKU / ID</span><strong>{line.sku || line.inventoryId}</strong>
                <span>Original name</span><strong>{line.originalName}</strong>
                <span>Quantity</span><strong>{line.quantity}</strong>
                <span>Received</span><strong>{savedReceipt.receivedDate}</strong>
                <span>Supplier</span><strong>{savedReceipt.supplier}</strong>
                <span>Landed cost</span><strong>{formatPrice(line.landedUnitCost)} each</strong>
              </div>
            </div>
          ))}
        </div>

        <style jsx global>{`
          @media print {
            body * { visibility: hidden !important; }
            #batch-tags, #batch-tags * { visibility: visible !important; }
            #batch-tags { display: grid !important; grid-template-columns: 1fr 1fr; gap: 12mm; position: absolute; inset: 0; padding: 8mm; }
            .batch-tag { break-inside: avoid; border: 2px solid #2b353f; border-radius: 4mm; padding: 6mm; min-height: 75mm; color: #111827; }
            .tag-brand { margin: 0; color: #435d69; font: 800 9pt Arial, sans-serif; letter-spacing: 1.2px; }
            .tag-code { margin: 4mm 0; font: 900 18pt ui-monospace, monospace; }
            .tag-name { min-height: 14mm; margin: 0 0 4mm; font: 800 12pt Arial, sans-serif; }
            .tag-grid { display: grid; grid-template-columns: 35mm 1fr; gap: 2mm; border-top: 1px solid #cbd5e1; padding-top: 3mm; font: 9pt Arial, sans-serif; }
            .tag-grid span { color: #64748b; }
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {setupError && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-bold">Database setup required</p>
          <p className="mt-1">Run <span className="font-mono">MIGRATION_INVENTORY_RECEIVING.sql</span> in Supabase, then reload this page.</p>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">Step 1</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Identify the shipment</h2>
            <p className="mt-1 text-sm text-slate-500">Every supplier order gets one permanent token shared by all items in it.</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600 sm:block">Batch</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch token" value={receiptCode} onChange={setReceiptCode} mono required />
          <Field label="Date received" value={receivedDate} onChange={(value) => {
            setReceivedDate(value);
            setReceiptCode((current) => current.startsWith("RCV-") ? makeBatchCode(value) : current);
          }} type="date" required />
          <Field label="Supplier" value={supplier} onChange={setSupplier} placeholder="Supplier or factory name" required />
          <Field label="Supplier invoice / PO" value={supplierInvoice} onChange={setSupplierInvoice} placeholder="Optional invoice number" />
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Container, shipment, or receiving notes"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">Step 2</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Add received products</h2>
          <p className="mt-1 text-sm text-slate-500">Enter the supplier price before freight, tariffs, and other shared costs.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search new name, original name, SKU, or ID"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-blue focus:bg-white" />
            {query.trim() && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {availableProducts.map((product) => (
                  <button key={product.id} type="button" onClick={() => addProduct(product)}
                    className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{product.name}</span>
                      {product.original_name !== product.name && <span className="block truncate text-xs text-slate-500">Original: {product.original_name}</span>}
                      <span className="block font-mono text-xs text-slate-500">{product.sku || product.id}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">In stock: {product.amount}</span>
                  </button>
                ))}
                {availableProducts.length === 0 && <p className="px-4 py-5 text-center text-sm text-slate-500">No existing product found. Use Create New Product.</p>}
              </div>
            )}
          </div>
          <button type="button" onClick={openNewProduct}
            className="shrink-0 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-black text-white hover:bg-brand-navy">
            + Create New Product
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {calculation.lines.map((line) => {
            const product = productFor(line.id);
            const currentAverage = Number(product?.cost_price) || 0;
            const nextAverage = weightedAverageCost(product?.amount ?? 0, currentAverage, line.quantity, line.landedUnitCost);
            return (
              <div key={line.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-slate-950">{product?.name ?? line.id}</p>
                      {product?.pendingNew && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">New product</span>}
                    </div>
                    {product?.original_name && product.original_name !== product.name && <p className="truncate text-xs text-slate-500">Original: {product.original_name}</p>}
                    <p className="font-mono text-xs text-slate-500">{product?.sku || line.id}</p>
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Remove</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <NumberField label="Quantity" value={line.quantity} onChange={(value) => updateLine(line.id, { quantity: value })} min={1} step={1} />
                  <NumberField label="Supplier cost each" value={line.supplierUnitCost} onChange={(value) => updateLine(line.id, { supplierUnitCost: value })} prefix="$" />
                  <NumberField label="Weight each (optional)" value={line.unitWeight} onChange={(value) => updateLine(line.id, { unitWeight: value })} suffix="lb" />
                  {allocationMode === "manual" ? (
                    <NumberField label="Shared cost for this line" value={line.manualAllocation} onChange={(value) => updateLine(line.id, { manualAllocation: value })} prefix="$" />
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Allocated expenses</p>
                      <p className="mt-1 font-mono text-sm font-black text-slate-900">{formatPrice(line.allocatedExpense)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Current avg. {formatPrice(currentAverage)} → New avg. <strong className="text-slate-800">{formatPrice(nextAverage)}</strong></span>
                  <div className="flex flex-wrap gap-2">
                    {product?.pendingNew && <span className="rounded-full bg-brand-navy/10 px-3 py-1 font-bold text-brand-navy">Customer price: {formatPrice(product.pendingNew.storePrice)}</span>}
                    <span className="rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">Landed: {formatPrice(line.landedUnitCost)} each</span>
                    {!product?.pendingNew && <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">Customer price: {Number(product?.store_price) > 0 ? formatPrice(Number(product?.store_price)) : "Set in Products"}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {lines.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Search above to add the first product in this shipment.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">Step 3</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Add shared expenses</h2>
          <p className="mt-1 text-sm text-slate-500">These costs are distributed across the products to calculate the real landed cost.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXPENSE_FIELDS.map((field) => (
            <label key={field.kind} className="rounded-2xl border border-slate-200 p-3">
              <span className="block text-sm font-bold text-slate-800">{field.label}</span>
              <span className="mt-0.5 block min-h-8 text-xs leading-4 text-slate-400">{field.hint}</span>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input type="number" min="0" step="0.01" value={expenses[field.kind] || ""}
                  onChange={(event) => setExpenses((current) => ({ ...current, [field.kind]: Number(event.target.value) || 0 }))}
                  placeholder="0.00" className="w-full rounded-xl border border-slate-300 py-2.5 pl-7 pr-3 text-sm outline-none focus:border-brand-blue" />
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button type="button" onClick={() => setAllocationMode("automatic")}
            className={`rounded-xl px-3 py-3 text-sm font-bold transition ${allocationMode === "automatic" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
            Smart allocation
          </button>
          <button type="button" onClick={() => setAllocationMode("manual")}
            className={`rounded-xl px-3 py-3 text-sm font-bold transition ${allocationMode === "manual" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
            Manual allocation
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {allocationMode === "automatic"
            ? `Freight is using ${calculation.freightUsesWeight ? "weight" : "item value"}. Tariffs and taxes use value; handling uses quantity.`
            : "Enter the total shared cost assigned to each product line above. The allocations must equal the shared expense total."}
        </p>
        {allocationMode === "manual" && calculation.manualDifference !== 0 && (
          <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${calculation.manualDifference > 0 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
            {formatPrice(Math.abs(calculation.manualDifference))} {calculation.manualDifference > 0 ? "still needs to be allocated" : "is over-allocated"}.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-brand-navy p-5 text-white shadow-lg sm:p-6">
        <div className="grid grid-cols-3 gap-3">
          <Summary label="Products" value={formatPrice(calculation.itemSubtotal)} />
          <Summary label="Expenses" value={formatPrice(calculation.sharedExpenses)} />
          <Summary label="Landed total" value={formatPrice(calculation.landedTotal)} strong />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
          <Summary label="Potential sales" value={formatPrice(forecast.potentialRevenue)} />
          <Summary label="Potential profit" value={formatPrice(forecast.potentialProfit)} strong />
          <Summary label="Estimated margin" value={`${forecast.margin.toFixed(1)}%`} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-300">Forecast uses today&apos;s customer selling price and this receipt&apos;s landed cost. The Sales Report uses the actual price collected after any discount.</p>
        {forecast.missingPriceCount > 0 && <p className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">Set a customer selling price for {forecast.missingPriceCount} receipt line{forecast.missingPriceCount === 1 ? "" : "s"} to include it in the forecast.</p>}
        {error && <div className="mt-5 rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-50">{error}</div>}
        <button type="button" onClick={receiveStock} disabled={saving || lines.length === 0 || Boolean(setupError)}
          className="mt-5 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-black text-brand-navy hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Receiving shipment..." : `Receive ${lines.reduce((sum, line) => sum + line.quantity, 0)} units into inventory`}
        </button>
        <p className="mt-2 text-center text-xs text-slate-300">This updates stock and average cost together. It cannot partially save.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-slate-950">Recent receiving batches</h2>
        <div className="mt-4 space-y-3">
          {recentReceipts.map((receipt) => (
            <details key={receipt.id} className="group rounded-2xl border border-slate-200 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-slate-900">{receipt.receipt_code}</p>
                  <p className="truncate text-xs text-slate-500">{receipt.supplier_name} · {receipt.received_date}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-slate-900">{formatPrice(receipt.landed_total)}</p>
                  <p className="text-xs text-slate-400">{receipt.inventory_receipt_items?.length ?? 0} products</p>
                </div>
              </summary>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {receipt.supplier_invoice && <p className="mb-2 text-xs text-slate-500">Invoice / PO: <strong>{receipt.supplier_invoice}</strong></p>}
                {(receipt.inventory_receipt_items ?? []).map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-1 text-xs">
                    <span className="min-w-0 text-slate-600">
                      <span className="block font-mono">{item.inventory_id} · Qty {item.quantity_received} · Remaining {item.remaining_quantity}</span>
                      {item.original_name_snapshot && <span className="block truncate text-slate-400">Original: {item.original_name_snapshot}</span>}
                    </span>
                    <span className="font-bold text-slate-800">{formatPrice(item.landed_unit_cost)} each</span>
                  </div>
                ))}
                <p className="mt-2 text-xs text-slate-400">Shared expenses: {formatPrice(receipt.shared_expenses)}</p>
                {receipt.inventory_receipt_items.some((item) => item.remaining_quantity > 0) ? (
                  <button type="button" onClick={() => { setCorrectingReceipt(receipt); setCorrectionError(""); }} className="mt-3 rounded-lg border border-brand-navy px-3 py-2 text-xs font-bold text-brand-navy hover:bg-brand-navy/5">Add missed expense</button>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">No tracked units remain in this receipt, so its costs are locked for accounting accuracy.</p>
                )}
              </div>
            </details>
          ))}
          {recentReceipts.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">No receiving batches yet.</p>}
        </div>
      </section>

      {newProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" onClick={() => setNewProduct(null)}>
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">Receive Stock</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Create New Product</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">It will be created with this shipment and hidden from the store until you choose to publish it.</p>
              </div>
              <button type="button" onClick={() => setNewProduct(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close new product form">Close</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="New Store Name" value={newProduct.name} onChange={updateNewProductName} placeholder="Customer-facing product name" required />
              <Field label="Original Supplier Name" value={newProduct.originalName} onChange={(value) => setNewProduct({ ...newProduct, originalName: value })} placeholder="Name on supplier invoice" required />

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Category *</span>
                <select value={newProduct.categoryId ?? ""} onChange={(event) => updateNewProductCategory(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.prefix})</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Smart Product ID *</span>
                <div className="flex gap-2">
                  <input value={newProduct.id} onChange={(event) => setNewProduct({ ...newProduct, id: event.target.value.toUpperCase(), smartIdentity: false })}
                    placeholder="SNK001" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono uppercase outline-none focus:border-brand-blue" />
                  <button type="button" onClick={forceNewProductIdentity} className="rounded-xl border border-brand-blue px-3 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue/5">Smart</button>
                </div>
              </label>

              <Field label="SKU" value={newProduct.sku} onChange={(value) => setNewProduct({ ...newProduct, sku: value.toUpperCase(), smartIdentity: false })} placeholder="SNK-0001" mono />
              <NumberField label="Customer selling price *" value={newProduct.storePrice} onChange={(value) => setNewProduct({ ...newProduct, storePrice: value })} prefix="$" min={0.01} />
              <NumberField label="Received quantity" value={newProduct.quantity} onChange={(value) => setNewProduct({ ...newProduct, quantity: value })} min={1} step={1} />
              <NumberField label="Supplier cost each" value={newProduct.supplierUnitCost} onChange={(value) => setNewProduct({ ...newProduct, supplierUnitCost: value })} prefix="$" />
              <NumberField label="Weight each (optional)" value={newProduct.unitWeight} onChange={(value) => setNewProduct({ ...newProduct, unitWeight: value })} suffix="lb" />

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 sm:col-span-2">
                <input type="checkbox" checked={newProduct.storeVisible} onChange={(event) => setNewProduct({ ...newProduct, storeVisible: event.target.checked })} className="h-4 w-4 rounded" />
                <span className="text-sm font-bold text-slate-700">Publish this item in the store immediately</span>
              </label>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">Customer selling price is the price shoppers see. Supplier cost plus the shared expenses becomes the internal landed cost. The category prefix controls the automatic ID: Sinks / SNK creates SNK001, Silicone / SIL creates SIL001, and Brackets / BRK creates BRK001.</p>
            {newProductError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{newProductError}</p>}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setNewProduct(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={queueNewProduct} disabled={categories.length === 0} className="flex-1 rounded-xl bg-brand-navy px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">Add to This Shipment</button>
            </div>
          </div>
        </div>
      )}

      {correctingReceipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center" onClick={() => setCorrectingReceipt(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">Receipt correction</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Add missed expense</h2>
            <p className="mt-2 text-sm leading-5 text-slate-500">This adds the cost to {correctingReceipt.receipt_code} and updates only units still on hand. Completed sales stay unchanged.</p>
            <label className="mt-5 block text-sm font-bold text-slate-700">Expense type
              <select value={correctionType} onChange={(event) => setCorrectionType(event.target.value as ExpenseKind)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                {EXPENSE_FIELDS.map((field) => <option key={field.kind} value={field.kind}>{field.label}</option>)}
              </select>
            </label>
            <Field label="Note (optional)" value={correctionLabel} onChange={setCorrectionLabel} placeholder="Late delivery invoice" />
            <div className="mt-4"><NumberField label="Amount" value={correctionAmount} onChange={setCorrectionAmount} prefix="$" min={0.01} /></div>
            {correctionError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{correctionError}</p>}
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => setCorrectingReceipt(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={addMissedExpense} disabled={correcting} className="flex-1 rounded-xl bg-brand-navy px-4 py-3 text-sm font-black text-white disabled:opacity-50">{correcting ? "Saving..." : "Add expense"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, mono, required }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}{required ? " *" : ""}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

function NumberField({ label, value, onChange, prefix, suffix, min = 0, step = 0.01 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
        <input type="number" min={min} step={step} value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)}
          className={`w-full rounded-xl border border-slate-300 py-2.5 text-sm outline-none focus:border-brand-blue ${prefix ? "pl-7" : "pl-3"} ${suffix ? "pr-9" : "pr-3"}`} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300 sm:text-xs">{label}</p>
      <p className={`mt-1 font-mono font-black ${strong ? "text-lg text-white sm:text-xl" : "text-sm text-slate-100 sm:text-base"}`}>{value}</p>
    </div>
  );
}
