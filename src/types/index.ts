export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface InventoryItem {
  id: string;
  name: string;
  category_name: string;
  brand: string;
  model_number: string;
  voltage: string;
  amount: number;
  store_price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[];
  featured: boolean;
  new_arrival: boolean;
  description: string;
  sku: string;
  stock_status: StockStatus;
  attributes: Record<string, string>;
  tax_enabled: boolean;
  tax_rate_percent: number;
  parent_id: string | null;
  variant_label: string;
  variant_dimension: string;
  part_number: string;
  variants?: InventoryItem[];
}

export interface Review {
  id: string;
  item_id: string;
  user_id: string;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  approved: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  prefix: string;
  color: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  item_id: string;
  name: string;
  sku: string;
  image_url: string | null;
  store_price: number;
  sale_price: number | null;
  quantity: number;
  variant_label?: string;
  part_number?: string;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "confirmed" | "ready" | "completed" | "cancelled" | "item_unavailable";

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
  user_id: string | null;
  status: OrderStatus;
  total: number;
  fulfillment: "pickup" | "delivery";
  delivery_address: string;
  delivery_fee: number;
  source?: "online" | "walk_in";
  walk_in_customer_id?: string | null;
  notes: string;
  attention_note: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}
