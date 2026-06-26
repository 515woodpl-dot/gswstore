import type { StockStatus } from "@/types";

export function formatPrice(val: number | null | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function stockLabel(status: StockStatus, amount?: number): string {
  if (status === "out_of_stock") return "Out of stock";
  if (status === "low_stock") return amount ? `Low stock (${amount} left)` : "Low stock";
  return "In stock";
}

export function stockColor(status: StockStatus): string {
  if (status === "out_of_stock") return "#dc3545";
  if (status === "low_stock") return "#f59e0b";
  return "#198754";
}

export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    ready: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export function orderStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#0d6efd",
    ready: "#198754",
    completed: "#6c757d",
    cancelled: "#dc3545",
  };
  return map[status] ?? "#6c757d";
}
