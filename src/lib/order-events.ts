// ── Order audit timeline ──────────────────────────────────────────────────
// Thin insert-only helper around order_events. Never throws — logging must
// never be the reason a financial operation fails, but failures are surfaced
// to the console so they're visible in server logs.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderEventType =
  | "order_created"
  | "item_added"
  | "item_removed"
  | "quantity_changed"
  | "discount_applied"
  | "discount_changed"
  | "payment_link_created"
  | "payment_link_replaced"
  | "payment_email_sent"
  | "payment_confirmed"
  | "test_payment_simulated"
  | "payment_failed"
  | "item_cancelled"
  | "quantity_partially_cancelled"
  | "partial_refund_requested"
  | "partial_refund_completed"
  | "partial_refund_failed"
  | "full_refund_requested"
  | "full_refund_completed"
  | "full_refund_failed"
  | "order_cancelled"
  | "order_marked_processing"
  | "order_marked_ready"
  | "ready_email_sent"
  | "order_completed";

export async function logOrderEvent(
  sb: SupabaseClient,
  args: {
    orderId: string;
    eventType: OrderEventType;
    actorId?: string | null;
    actorName?: string;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string;
    squareRef?: string | null;
  },
): Promise<void> {
  try {
    const { error } = await sb.from("order_events").insert({
      order_id: args.orderId,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      actor_name: args.actorName ?? "",
      previous_value: args.previousValue ?? null,
      new_value: args.newValue ?? null,
      reason: args.reason ?? "",
      square_ref: args.squareRef ?? null,
    });
    if (error) console.error(`[OrderEvents] insert failed for ${args.orderId}:`, error.message);
  } catch (e) {
    console.error("[OrderEvents] unexpected error:", e instanceof Error ? e.message : e);
  }
}
