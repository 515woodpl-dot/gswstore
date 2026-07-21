import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { createClient } from "@/lib/supabase/server";

function sq() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Sandbox,
  });
}

const DECLINE_MESSAGES: Record<string, string> = {
  GENERIC_DECLINE: "Your card was declined. Please try a different card.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds.",
  CVV_FAILURE: "The CVV on file did not match.",
  ADDRESS_VERIFICATION_FAILURE: "Address verification failed.",
  CARD_EXPIRED: "Your saved card has expired. Please add a new card.",
  CARD_NOT_SUPPORTED: "This card type is not supported.",
};

// POST { squareCardId, amountCents } — charge a saved card
export async function POST(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { squareCardId, amountCents } = await request.json();
    if (!squareCardId || !amountCents) {
      return NextResponse.json({ error: "Missing card ID or amount." }, { status: 400 });
    }

    // Confirm this card belongs to the user.
    const { data: saved } = await sb
      .from("saved_cards")
      .select("square_card_id")
      .eq("user_id", user.id)
      .eq("square_card_id", squareCardId)
      .single();
    if (!saved) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    const { payment } = await sq().payments.create({
      sourceId: squareCardId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(Math.round(amountCents)),
        currency: "USD",
      },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      customerId: user.id,
      note: "Web order (saved card)",
    });

    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      return NextResponse.json({ error: "Payment could not be processed." }, { status: 402 });
    }

    console.log(`[Square] saved-card payment ${payment.id} COMPLETED for ${amountCents} cents`);
    return NextResponse.json({ ok: true, paymentId: payment.id });
  } catch (err: unknown) {
    if (err instanceof SquareError) {
      const code = err.errors?.[0]?.code ?? "GENERIC_DECLINE";
      const friendly = DECLINE_MESSAGES[code] ?? "Your card was declined. Please try a different card.";
      console.warn("[Square] saved card declined:", code);
      return NextResponse.json({ error: friendly }, { status: 402 });
    }
    console.error("[Square] saved card charge error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Payment failed. Please try again." }, { status: 500 });
  }
}
