// ── Centralized Square service for admin-created payment-link orders ────────
// Mirrors the existing raw-REST pattern used by src/app/api/square/pay and
// charge-saved (this codebase talks to Square over fetch, not the SDK), so
// all Square business logic for this feature lives in one module instead of
// being scattered across route handlers.
import { createHmac, timingSafeEqual } from "crypto";

const SQUARE_API = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2024-07-17";

function headers() {
  return {
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": SQUARE_VERSION,
  };
}

export interface SquareLineItem {
  name: string;
  quantity: string; // Square wants a string
  basePriceMoneyCents: number;
}

export interface CreatePaymentLinkArgs {
  idempotencyKey: string;
  referenceId: string; // our order_number
  lineItems: SquareLineItem[];
  /** Total discount already folded in? No — Square wants a discount line so totals reconcile with our own math. */
  discountCents?: number;
  discountName?: string;
  buyerEmail?: string;
  redirectUrl?: string;
  note?: string;
}

export interface PaymentLinkResult {
  paymentLinkId: string;
  url: string;
  squareOrderId: string;
}

/**
 * Creates a brand-new Square Order + hosted Payment Link in one call.
 * Square's Payment Links API creates the Order for us when given `order`.
 */
export async function createPaymentLink(args: CreatePaymentLinkArgs): Promise<PaymentLinkResult> {
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  if (!process.env.SQUARE_ACCESS_TOKEN || !locationId) {
    throw new Error("Square is not configured (missing access token or location id).");
  }

  const lineItems = args.lineItems.map((li) => ({
    name: li.name.slice(0, 500),
    quantity: li.quantity,
    base_price_money: { amount: Math.round(li.basePriceMoneyCents), currency: "USD" },
  }));

  const order: Record<string, unknown> = {
    location_id: locationId,
    reference_id: args.referenceId,
    line_items: lineItems,
  };

  if (args.discountCents && args.discountCents > 0) {
    order.discounts = [
      {
        name: (args.discountName || "Discount").slice(0, 500),
        amount_money: { amount: Math.round(args.discountCents), currency: "USD" },
        scope: "ORDER",
      },
    ];
  }

  const body: Record<string, unknown> = {
    idempotency_key: args.idempotencyKey,
    order,
    checkout_options: {
      redirect_url: args.redirectUrl,
      ask_for_shipping_address: false,
    },
  };
  if (args.buyerEmail) {
    body.pre_populated_data = { buyer_email: args.buyerEmail };
  }
  if (args.note) {
    (body as Record<string, unknown>)["description"] = args.note.slice(0, 4096);
  }

  const res = await fetch(`${SQUARE_API}/online-checkout/payment-links`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || `Square error ${res.status}`;
    throw new Error(msg);
  }

  const link = data.payment_link;
  if (!link?.id || !link?.url || !link?.order_id) {
    throw new Error("Square did not return a usable payment link.");
  }
  return { paymentLinkId: link.id, url: link.url, squareOrderId: link.order_id };
}

/**
 * Deactivates a previously issued payment link so the customer can never pay
 * an outdated amount. A missing link is already inactive; every other failure
 * is fatal because issuing a replacement would leave two payable totals.
 */
export async function cancelPaymentLink(paymentLinkId: string): Promise<void> {
  const res = await fetch(`${SQUARE_API}/online-checkout/payment-links/${paymentLinkId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 404) return;
    const message = data?.errors?.[0]?.detail || `Square could not deactivate payment link (${res.status}).`;
    throw new Error(message);
  }
}

export interface RefundArgs {
  idempotencyKey: string;
  paymentId: string;
  amountCents: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export async function createRefund(args: RefundArgs): Promise<RefundResult> {
  if (args.amountCents <= 0) throw new Error("Refund amount must be greater than zero.");
  const res = await fetch(`${SQUARE_API}/refunds`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      idempotency_key: args.idempotencyKey,
      payment_id: args.paymentId,
      amount_money: { amount: Math.round(args.amountCents), currency: "USD" },
      reason: (args.reason || "").slice(0, 192),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || `Square refund error ${res.status}`;
    throw new Error(msg);
  }
  const refund = data.refund;
  if (!refund?.id) throw new Error("Square did not return a refund id.");
  return { refundId: refund.id, status: refund.status };
}

export interface SquarePayment {
  id: string;
  status: string;
  order_id?: string;
  amount_money?: { amount: number; currency: string };
  receipt_url?: string;
}

export async function getPayment(paymentId: string): Promise<SquarePayment> {
  const res = await fetch(`${SQUARE_API}/payments/${paymentId}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Square error ${res.status}`);
  return data.payment as SquarePayment;
}

// ── Webhook signature verification ───────────────────────────────────────────
// Square signs: HMAC-SHA256(signatureKey, notificationUrl + rawRequestBody),
// base64-encoded, sent in the `x-square-hmacsha256-signature` header.
// The raw body MUST be used (not a re-serialized/parsed version) or the
// signature will never match.
export function verifySquareWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  notificationUrl: string,
): boolean {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!signatureKey || !signatureHeader) return false;

  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + rawBody)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
