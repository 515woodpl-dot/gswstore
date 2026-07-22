import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

const SQUARE_API = "https://connect.squareup.com/v2";

const DECLINE_MESSAGES: Record<string, string> = {
  GENERIC_DECLINE: "Your card was declined. Please try a different card.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds.",
  CVV_FAILURE: "The CVV on file did not match.",
  ADDRESS_VERIFICATION_FAILURE: "Address verification failed.",
  CARD_EXPIRED: "Your saved card has expired. Please add a new card.",
  CARD_NOT_SUPPORTED: "This card type is not supported.",
};

export async function POST(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { squareCardId, amountCents } = await request.json();
    if (!squareCardId || !amountCents) {
      return NextResponse.json({ error: "Missing card ID or amount." }, { status: 400 });
    }

    const { data: saved } = await sb.from("saved_cards").select("square_card_id").eq("user_id", user.id).eq("square_card_id", squareCardId).single();
    if (!saved) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    const res = await fetch(`${SQUARE_API}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-07-17",
      },
      body: JSON.stringify({
        source_id: squareCardId,
        idempotency_key: randomUUID(),
        amount_money: { amount: Math.round(amountCents), currency: "USD" },
        location_id: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
        note: "Web order (saved card)",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const code = data.errors?.[0]?.code ?? "GENERIC_DECLINE";
      const friendly = DECLINE_MESSAGES[code] ?? "Your card was declined. Please try a different card.";
      console.warn("[Square] saved card declined:", code);
      return NextResponse.json({ error: friendly }, { status: 402 });
    }

    const payment = data.payment;
    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      return NextResponse.json({ error: "Payment could not be processed." }, { status: 402 });
    }

    console.log(`[Square] saved-card payment ${payment.id} COMPLETED for ${amountCents} cents`);
    return NextResponse.json({ ok: true, paymentId: payment.id });

  } catch (err) {
    console.error("[Square] charge-saved error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Payment failed. Please try again." }, { status: 500 });
  }
}
