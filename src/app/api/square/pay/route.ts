import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const SQUARE_API = "https://connect.squareup.com/v2";

const DECLINE_MESSAGES: Record<string, string> = {
  GENERIC_DECLINE: "Your card was declined. Please try a different card.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds.",
  TRANSACTION_LIMIT: "This transaction exceeds your card limit.",
  CVV_FAILURE: "The CVV you entered is incorrect.",
  ADDRESS_VERIFICATION_FAILURE: "The billing address didn't match. Please check and try again.",
  CARD_EXPIRED: "Your card has expired. Please use a different card.",
  CARD_NOT_SUPPORTED: "This card type is not supported.",
  INVALID_ACCOUNT: "This card account is invalid. Please try a different card.",
  VOICE_FAILURE: "Your card was declined. Please contact your bank.",
};

export async function POST(request: NextRequest) {
  try {
    const { sourceId, amountCents, billing } = await request.json();

    if (!sourceId || typeof amountCents !== "number" || amountCents <= 0) {
      return NextResponse.json({ error: "Missing card token or invalid amount." }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      source_id: sourceId,
      idempotency_key: randomUUID(),
      amount_money: { amount: Math.round(amountCents), currency: "USD" },
      location_id: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
      note: billing?.name ? `Web order — ${billing.name}` : "Web order",
    };

    if (billing) {
      body.billing_address = {
        first_name: billing.name?.split(" ")[0],
        last_name: billing.name?.split(" ").slice(1).join(" "),
        address_line_1: billing.line1,
        address_line_2: billing.line2 || undefined,
        locality: billing.city,
        administrative_district_level_1: billing.state,
        postal_code: billing.postalCode,
        country: "US",
      };
    }

    const res = await fetch(`${SQUARE_API}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-07-17",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const code = data.errors?.[0]?.code ?? "GENERIC_DECLINE";
      const friendly = DECLINE_MESSAGES[code] ?? "Your card was declined. Please try a different card.";
      console.warn("[Square] payment declined:", code);
      return NextResponse.json({ error: friendly }, { status: 402 });
    }

    const payment = data.payment;
    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      return NextResponse.json({ error: "Payment could not be processed." }, { status: 402 });
    }

    console.log(`[Square] payment ${payment.id} COMPLETED for ${amountCents} cents`);
    return NextResponse.json({ ok: true, paymentId: payment.id, status: payment.status });

  } catch (err) {
    console.error("[Square] pay error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Payment failed. Please try again." }, { status: 500 });
  }
}
