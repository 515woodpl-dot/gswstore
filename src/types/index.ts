// ── Inventory (read from Flask API on Pi) ────────────────────────────────────

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface InventoryItem {
  id: string;
  name: string;
  category_name: string;
  brand: string;
  model_number: string;
  serial_number: string;
  location: string;
  warranty: string;
  voltage: string;
  amount: number;
  price: number;
  purchase_date: string;
  added_by: string;
  added_date: string;
  image_url: string | null;
  description: string;
  sku: string;
  store_visible: boolean;
  store_price: number;
  stock_status: StockStatus;
}

export interface Category {
  id: number;
  name: string;
  prefix: string;
  color: string;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;          // cart_items PK
  cart_id: string;
  item_id: string;     // inventory item id e.g. "C001"
  name: string;
  sku: string;
  image_url: string | null;
  store_price: number;
  quantity: number;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];
  created_at: string;
  updated_at: string;
}

// ── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "confirmed" | "ready" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  name: string;
  sku: string;
  image_url: string | null;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  total: number;
  notes: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  status?: number;
}
