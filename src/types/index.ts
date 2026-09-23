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
  cost_price?: number;
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
  base_unit?: string;
  selling_unit?: string;
  units_per_sale?: number;
  packaging_reviewed?: boolean;
  dimensions: string;
  weight: string;
  material: string;
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
  base_unit?: string;
  selling_unit?: string;
  units_per_sale?: number;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "pending" | "confirmed" | "ready" | "completed" | "cancelled" | "item_unavailable"
  // Admin-created / online-payment-link lifecycle:
  | "draft" | "awaiting_payment" | "processing";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed";

export type OrderItemStatus = "active" | "cancelled";

export type OrderSource = "online" | "walk_in" | "manual" | "admin_payment_link";

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  name: string;
  sku: string;
  image_url: string | null;
  unit_price: number;
  list_price?: number;
  cost_price?: number;
  base_units_per_sale?: number;
  quantity: number;
  // Admin-created / cancellation tracking (all optional so existing online
  // and walk-in order rows — which default these server-side — still type-check):
  status?: OrderItemStatus;
  cancelled_quantity?: number;
  fulfilled_quantity?: number;
  tax_amount?: number;
  net_amount?: number;
  discount_amount?: number;
  discount_reason?: string;
  discount_type?: "percent" | "fixed" | "";
  cancellation_reason?: string;
  cancellation_note?: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  refunded_amount?: number;
  refunded_tax_amount?: number;
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
  source?: OrderSource;
  walk_in_customer_id?: string | null;
  notes: string;
  attention_note: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  is_test?: boolean;

  // Admin-created payment-link orders:
  payment_status?: PaymentStatus;
  subtotal?: number;
  discount_total?: number;
  discount_type?: "percent" | "fixed" | "";
  discount_reason?: string;
  tax_rate?: number;
  tax_total?: number;
  amount_paid?: number;
  amount_refunded?: number;
  internal_notes?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  square_order_id?: string | null;
  square_payment_id?: string | null;
  square_payment_link_id?: string | null;
  square_payment_link_url?: string | null;
  square_payment_link_status?: "none" | "active" | "replaced" | "paid" | "cancelled";
  square_receipt_url?: string | null;
  payment_link_sent_at?: string | null;
  paid_at?: string | null;
  ready_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string;
  cancellation_note?: string;
  cancelled_by?: string | null;
  refund_failed_reason?: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string;
  square_ref: string | null;
  created_at: string;
}

export interface OrderRefund {
  id: string;
  order_id: string;
  order_item_id: string | null;
  square_refund_id: string | null;
  square_payment_id: string | null;
  amount: number;
  status: "creating" | "pending" | "completed" | "failed";
  reason: string;
  created_by: string | null;
  created_at: string;
  confirmed_at: string | null;
}
