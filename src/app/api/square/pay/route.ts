import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment } from "square";

// Server-only Square client. Uses the sandbox token from env.
function squareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    // Switch to SquareEnvironment.Production when going live.
    environment: SquareEnvironment.Sandbox,
  });
}

// POST { sourceId, amountCents }  → charges the card token via Square.
export async function POST(request: NextRequest) {
  try {
    const { sourceId, amountCents } = await request.json();

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
    });

    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      return NextResponse.json({ error: `Payment ${payment?.status ?? "failed"}.` }, { status: 402 });
    }

    return NextResponse.json({ ok: true, paymentId: payment.id, status: payment.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Payment failed.";
    console.error("[Square] payment error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
