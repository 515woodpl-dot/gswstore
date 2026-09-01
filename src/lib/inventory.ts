import { createClient } from "@/lib/supabase/server";
import type { InventoryItem, Category, StockStatus, Review } from "@/types";

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
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  featured: boolean;
  new_arrival: boolean;
  store_visible: boolean;
  attributes: Record<string, string> | null;
  tax_enabled: boolean | null;
  tax_rate_percent: number | null;
  parent_id: string | null;
  variant_label: string | null;
  variant_dimension: string | null;
  part_number: string | null;
  base_unit: string | null;
  selling_unit: string | null;
  units_per_sale: number | null;
  packaging_reviewed: boolean | null;
  created_at?: string;
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
    sale_price: r.sale_price != null ? Number(r.sale_price) : null,
    image_url: r.image_url,
    images: r.images ?? [],
    featured: r.featured ?? false,
    new_arrival: r.new_arrival ?? false,
    stock_status: deriveStockStatus(r.amount),
    attributes: r.attributes ?? {},
    tax_enabled: r.tax_enabled ?? false,
    tax_rate_percent: r.tax_rate_percent != null ? Number(r.tax_rate_percent) : 0,
    parent_id: r.parent_id ?? null,
    variant_label: r.variant_label ?? "",
    variant_dimension: r.variant_dimension ?? "Option",
    part_number: r.part_number ?? "",
    base_unit: r.base_unit || "Each",
    selling_unit: r.selling_unit || "Each",
    units_per_sale: Number(r.units_per_sale) || 1,
    packaging_reviewed: r.packaging_reviewed ?? false,
  };
}

const COLS = "id,name,category_name,brand,model_number,voltage,sku,description,amount,store_price,sale_price,image_url,images,featured,new_arrival,store_visible,attributes,tax_enabled,tax_rate_percent,parent_id,variant_label,variant_dimension,part_number,base_unit,selling_unit,units_per_sale,packaging_reviewed,created_at";

// ── Public store reads (visible items only) ──────────────────────────────────

export async function getStoreItems(): Promise<InventoryItem[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("inventory").select(COLS)
    .eq("store_visible", true)
    .is("parent_id", null)
    .order("category_name", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as InventoryRow[]).map(rowToItem);
}

export async function getStoreItem(id: string): Promise<InventoryItem> {
  const sb = await createClient();
  const { data, error } = await sb.from("inventory").select(COLS).eq("id", id).single();
  if (error || !data) throw new Error("Not found");
  const item = rowToItem(data as InventoryRow);

  // Fetch variants (child rows pointing to this product)
  const { data: variantRows } = await sb
    .from("inventory").select(COLS)
    .eq("parent_id", id)
    .order("store_price", { ascending: true });
  if (variantRows && variantRows.length > 0) {
    item.variants = (variantRows as InventoryRow[]).map(rowToItem);
  }
  return item;
}

export async function getFeaturedItems(limit = 5): Promise<InventoryItem[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("inventory").select(COLS)
    .eq("store_visible", true).eq("featured", true)
    .is("parent_id", null)
    .order("name", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as InventoryRow[]).map(rowToItem);
}

export async function getHeroItems(): Promise<InventoryItem[]> {
  return getFeaturedItems(3);
}

export async function getStoreCategories(): Promise<Category[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("categories").select("id,name,prefix,color")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as Category[];
}

export async function getNewArrivals(limit = 8): Promise<InventoryItem[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("inventory").select(COLS)
    .eq("store_visible", true)
    .eq("new_arrival", true)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as InventoryRow[]).map(rowToItem);
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export async function getItemReviews(itemId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("reviews")
    .select("id,item_id,user_id,author_name,rating,title,body,approved,created_at")
    .eq("item_id", itemId)
    .eq("approved", true)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Review[];
}

export interface ReviewSummary { count: number; average: number; }

export function summarizeReviews(reviews: Review[]): ReviewSummary {
  if (reviews.length === 0) return { count: 0, average: 0 };
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return { count: reviews.length, average: Math.round((sum / reviews.length) * 10) / 10 };
}
