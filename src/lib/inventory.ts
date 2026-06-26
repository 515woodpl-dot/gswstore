import type { InventoryItem, Category } from "@/types";

const BASE = process.env.INVENTORY_API_BASE || "http://localhost:7000";
const TIMEOUT_MS = 8000;

async function fetchInventory<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Next.js cache: revalidate store data every 60 seconds
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Inventory API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function getStoreItems(): Promise<InventoryItem[]> {
  return fetchInventory<InventoryItem[]>("/api/store/items");
}

export async function getStoreItem(id: string): Promise<InventoryItem> {
  return fetchInventory<InventoryItem>(`/api/store/items/${encodeURIComponent(id)}`);
}

export async function getStoreCategories(): Promise<Category[]> {
  return fetchInventory<Category[]>("/api/store/categories");
}
