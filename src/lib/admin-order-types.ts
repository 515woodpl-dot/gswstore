// Lightweight row shapes for the service-role Supabase queries used across
// the admin payment-link order routes. Kept separate from src/types/index.ts
// (the app-wide Order/OrderItem types) because these routes read/write a few
// raw DB columns directly and want a bit more certainty about nullability.
export interface AdminOrderItemRow {
  id: string;
  order_id: string;
  item_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  unit_price: number;
  net_amount: number;
  list_price: number | null;
  cost_price: number | null;
  quantity: number;
  base_units_per_sale: number;
  cancelled_quantity: number;
  fulfilled_quantity: number;
  status: string;
  discount_amount: number;
  discount_reason: string;
  cancellation_reason: string;
  cancellation_note: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  refunded_amount: number;
  tax_amount: number;
  refunded_tax_amount: number;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  is_test: boolean;
  test_inventory_reserved?: boolean;
  total: number;
  subtotal: number;
  discount_total: number;
  tax_rate: number;
  tax_total: number;
  amount_paid: number;
  amount_refunded: number;
  notes: string;
  walk_in_customer_id: string | null;
  square_order_id: string | null;
  square_payment_id: string | null;
  square_payment_link_id: string | null;
  square_payment_link_url: string | null;
  square_payment_link_status: string;
  square_receipt_url: string | null;
  cancellation_reason: string;
  cancellation_note: string;
  order_items: AdminOrderItemRow[];
}

export interface CustomerRow {
  name: string;
  email: string;
}
