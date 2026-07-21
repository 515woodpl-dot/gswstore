import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment, SquareError } from "square";

function squareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    // Switch to SquareEnvironment.Production when going live.
    environment: SquareEnvironment.Sandbox,
  });
}

// Friendly decline messages keyed by Square error code.
const DECLINE_MESSAGES: Record<string, string> = {
  GENERIC_DECLINE:          "Your card was declined. Please try a different card.",
  INSUFFICIENT_FUNDS:       "Your card has insufficient funds.",
  TRANSACTION_LIMIT:        "This transaction exceeds your card limit.",
  CVV_FAILURE:              "The CVV you entered is incorrect.",
  ADDRESS_VERIFICATION_FAILURE: "The billing address didn't match. Please check and try again.",
  CARD_EXPIRED:             "Your card has expired. Please use a different card.",
  CARD_NOT_SUPPORTED:       "This card type is not supported.",
  INVALID_ACCOUNT:          "This card account is invalid. Please try a different card.",
  VOICE_FAILURE:            "Your card was declined. Please contact your bank.",
};

export async function POST(request: NextRequest) {
  try {
    const { sourceId, amountCents, billing } = await request.json();

    if (!sourceId || typeof amountCents !== "number" || amountCents <= 0) {
      return NextResponse.json({ error: "Missing card token or invalid amount." }, { status: 400 });
    }

    const client = squareClient();
    const { payment } = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(Math.round(amountCents)),
        currency: "USD",
      },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      note: billing?.name ? `Web order — ${billing.name}` : "Web order",
      billingAddress: billing
        ? {
            firstName: billing.name?.split(" ")[0],
            lastName: billing.name?.split(" ").slice(1).join(" "),
            addressLine1: billing.line1,
            addressLine2: billing.line2 || undefined,
            locality: billing.city,
            administrativeDistrictLevel1: billing.state,
            postalCode: billing.postalCode,
            country: "US",
          }
        : undefined,
    });

    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      // Payment object returned but not approved — shouldn't normally happen,
      // but handle gracefully.
      console.warn("[Square] unexpected payment status:", payment?.status);
      return NextResponse.json(
        { error: "Your payment could not be processed. Please try again." },
        { status: 402 }
      );
    }

    // Log only non-sensitive confirmation info.
    console.log(`[Square] payment ${payment.id} COMPLETED for ${amountCents} cents`);
    return NextResponse.json({ ok: true, paymentId: payment.id, status: payment.status });

  } catch (err: unknown) {
    // Square throws SquareError on declines — extract the human-readable code.
    if (err instanceof SquareError) {
      const firstError = err.errors?.[0];
      const code = firstError?.code ?? "GENERIC_DECLINE";
      const friendly = DECLINE_MESSAGES[code] ?? "Your card was declined. Please try a different card.";
      // Log only the code, not the full response.
      console.warn("[Square] card declined:", code);
      return NextResponse.json({ error: friendly }, { status: 402 });
    }
    // Unexpected error (network, config, etc.)
    console.error("[Square] unexpected error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { error: "Payment failed due to a system error. Please try again." },
      { status: 500 }
    );
  }
}
