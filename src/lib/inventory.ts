import { createClient } from "@/lib/supabase/server";
import type { InventoryItem, Category, StockStatus } from "@/types";

// ── Stock status derivation (0 = out, 1-9 = low, 10+ = in) ───────────────────
export function deriveStockStatus(amount: number): StockStatus {
  if (amount <= 0) return "out_of_stock";
  if (amount < 10) return "low_stock";
  return "in_stock";
}

interface InventoryRow {
  id: string;
  name: string;
  category_name: string;
  brand: string | null;
  model_number: string | null;
  voltage: string | null;
  sku: string | null;
  description: string | null;
  amount: number;
  store_price: number;
  image_url: string | null;
  store_visible: boolean;
}

function rowToItem(r: InventoryRow): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    category_name: r.category_name || "",
    brand: r.brand || "",
    model_number: r.model_number || "",
    voltage: r.voltage || "",
    sku: r.sku || "",
    description: r.description || "",
    amount: r.amount,
    store_price: Number(r.store_price),
    image_url: r.image_url,
    stock_status: deriveStockStatus(r.amount),
  };
}

const COLS = "id,name,category_name,brand,model_number,voltage,sku,description,amount,store_price,image_url,store_visible";

// ── Public store reads (visible items only) ──────────────────────────────────

export async function getStoreItems(): Promise<InventoryItem[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("inventory").select(COLS)
    .eq("store_visible", true)
    .order("category_name", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as InventoryRow[]).map(rowToItem);
}

export async function getStoreItem(id: string): Promise<InventoryItem> {
  const sb = await createClient();
  const { data, error } = await sb.from("inventory").select(COLS).eq("id", id).single();
  if (error || !data) throw new Error("Not found");
  return rowToItem(data as InventoryRow);
}

export async function getStoreCategories(): Promise<Category[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("categories").select("id,name,prefix,color")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as Category[];
}
