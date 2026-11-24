import type { PaymentMethod } from "@/components/admin/SaleComplianceFields";

export function isSquareWalkIn(paymentMethod: PaymentMethod): boolean {
  return paymentMethod === "square";
}

export function walkInOrderState(paymentMethod: PaymentMethod) {
  return isSquareWalkIn(paymentMethod)
    ? { status: "awaiting_payment", paymentStatus: "unpaid" }
    : { status: "completed", paymentStatus: "paid" };
}
