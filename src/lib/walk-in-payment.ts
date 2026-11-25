import type { PaymentMethod } from "@/components/admin/SaleComplianceFields";

export function isSquareWalkIn(paymentMethod: PaymentMethod): boolean {
  return paymentMethod === "square";
}

export function walkInOrderState(paymentMethod: PaymentMethod) {
  return isSquareWalkIn(paymentMethod)
    ? { status: "awaiting_payment", payment_status: "unpaid" }
    : { status: "completed", payment_status: "paid" };
}
