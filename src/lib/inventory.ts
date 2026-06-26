import type { InventoryItem, Category } from "@/types";

const BASE = process.env.INVENTORY_API_BASE || "http://localhost:7000";

// ── Mock data (shown when Pi API is unreachable) ──────────────────────────────

export const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: "Power Tools",    prefix: "P", color: "#e74c3c" },
  { id: 2, name: "Hand Tools",     prefix: "H", color: "#2980b9" },
  { id: 3, name: "Measuring",      prefix: "M", color: "#27ae60" },
  { id: 4, name: "Safety",         prefix: "S", color: "#f39c12" },
];

export const MOCK_ITEMS: InventoryItem[] = [
  {
    id: "P001", name: "DeWalt 20V Cordless Drill", category_name: "Power Tools",
    brand: "DeWalt", model_number: "DCD777C2", voltage: "20V", amount: 15,
    store_price: 129.99, sku: "DW-DCD777C2",
    image_url: "https://placehold.co/400x400/1a1a1a/ffffff?text=Cordless+Drill",
    description: "Compact and lightweight 20V MAX* brushless drill/driver with 2 batteries included.", stock_status: "in_stock",
  },
  {
    id: "P002", name: "Milwaukee M18 Circular Saw", category_name: "Power Tools",
    brand: "Milwaukee", model_number: "2730-20", voltage: "18V", amount: 8,
    store_price: 189.00, sku: "MW-2730-20",
    image_url: "https://placehold.co/400x400/c0392b/ffffff?text=Circular+Saw",
    description: "18V brushless 6-1/2 in. circular saw with REDLINK PLUS intelligence.", stock_status: "in_stock",
  },
  {
    id: "P003", name: "Bosch Random Orbit Sander", category_name: "Power Tools",
    brand: "Bosch", model_number: "ROS20VSC", voltage: "120V", amount: 5,
    store_price: 69.99, sku: "BS-ROS20VSC",
    image_url: "https://placehold.co/400x400/8e44ad/ffffff?text=Orbit+Sander",
    description: "5 in. variable-speed random orbit sander with vibration control.", stock_status: "low_stock",
  },
  {
    id: "P004", name: "Makita Angle Grinder", category_name: "Power Tools",
    brand: "Makita", model_number: "GA4530", voltage: "120V", amount: 0,
    store_price: 59.99, sku: "MK-GA4530",
    image_url: "https://placehold.co/400x400/2c3e50/ffffff?text=Angle+Grinder",
    description: "4-1/2 in. angle grinder with anti-restart function for operator safety.", stock_status: "out_of_stock",
  },
  {
    id: "H001", name: "Stanley 16oz Claw Hammer", category_name: "Hand Tools",
    brand: "Stanley", model_number: "51-167", voltage: "N/A", amount: 40,
    store_price: 24.99, sku: "ST-51-167",
    image_url: "https://placehold.co/400x400/2980b9/ffffff?text=Claw+Hammer",
    description: "16 oz. steel claw hammer with anti-vibe handle for reduced vibration.", stock_status: "in_stock",
  },
  {
    id: "H002", name: "Irwin 10-Piece Screwdriver Set", category_name: "Hand Tools",
    brand: "Irwin", model_number: "IW65101", voltage: "N/A", amount: 22,
    store_price: 34.99, sku: "IW-IW65101",
    image_url: "https://placehold.co/400x400/16a085/ffffff?text=Screwdriver+Set",
    description: "10-piece screwdriver set with ergonomic bi-material handles.", stock_status: "in_stock",
  },
  {
    id: "M001", name: "Stanley 25ft Tape Measure", category_name: "Measuring",
    brand: "Stanley", model_number: "33-725", voltage: "N/A", amount: 30,
    store_price: 14.99, sku: "ST-33-725",
    image_url: "https://placehold.co/400x400/27ae60/ffffff?text=Tape+Measure",
    description: "25 ft x 1 in. FATMAX tape measure with BladeArmor coating.", stock_status: "in_stock",
  },
  {
    id: "S001", name: "3M Safety Glasses", category_name: "Safety",
    brand: "3M", model_number: "SF400AF", voltage: "N/A", amount: 3,
    store_price: 9.99, sku: "3M-SF400AF",
    image_url: "https://placehold.co/400x400/f39c12/ffffff?text=Safety+Glasses",
    description: "Anti-fog safety glasses with UV protection and wrap-around design.", stock_status: "low_stock",
  },
];

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchInventory<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getStoreItems(): Promise<InventoryItem[]> {
  try {
    return await fetchInventory<InventoryItem[]>("/api/store/items");
  } catch {
    return MOCK_ITEMS;
  }
}

export async function getStoreItem(id: string): Promise<InventoryItem> {
  try {
    return await fetchInventory<InventoryItem>(`/api/store/items/${encodeURIComponent(id)}`);
  } catch {
    const mock = MOCK_ITEMS.find((i) => i.id === id);
    if (mock) return mock;
    throw new Error("Not found");
  }
}

export async function getStoreCategories(): Promise<Category[]> {
  try {
    return await fetchInventory<Category[]>("/api/store/categories");
  } catch {
    return MOCK_CATEGORIES;
  }
}
