import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment } from "square";
import { createClient } from "@/lib/supabase/server";

function sq() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Sandbox, // switch to Production when going live
  });
}

// GET — list saved cards for the current user
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cards } = await sb
    .from("saved_cards")
    .select("id,square_card_id,brand,last_4,exp_month,exp_year,cardholder_name,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ cards: cards ?? [] });
}

// POST { sourceId, cardholderName } — save a new card
export async function POST(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sourceId, cardholderName } = await request.json();
    if (!sourceId) return NextResponse.json({ error: "Missing card token." }, { status: 400 });

    const client = sq();

    // Get or create the Square Customer for this user.
    let squareCustomerId: string | undefined;
    const { data: profile } = await sb.from("profiles").select("square_customer_id").eq("id", user.id).single();
    squareCustomerId = profile?.square_customer_id ?? undefined;

    if (!squareCustomerId) {
      const { customer } = await client.customers.create({
        idempotencyKey: randomUUID(),
        emailAddress: user.email,
        note: `GSW user ${user.id}`,
      });
      squareCustomerId = customer?.id;
      if (!squareCustomerId) throw new Error("Failed to create Square customer.");
      await sb.from("profiles").update({ square_customer_id: squareCustomerId }).eq("id", user.id);
    }

    // Save the card to the Square Customer.
    const { card } = await client.cards.create({
      idempotencyKey: randomUUID(),
      sourceId,
      card: {
        customerId: squareCustomerId,
        cardholderName: cardholderName || user.email,
      },
    });
    if (!card?.id) throw new Error("Failed to save card.");

    // Mirror non-sensitive metadata in our DB for display.
    await sb.from("saved_cards").insert({
      user_id: user.id,
      square_card_id: card.id,
      brand: card.cardBrand ?? "",
      last_4: card.last4 ?? "",
      exp_month: Number(card.expMonth ?? 0),
      exp_year: Number(card.expYear ?? 0),
      cardholder_name: cardholderName || "",
    });

    console.log(`[Square] card saved for user ${user.id}: ...${card.last4}`);
    return NextResponse.json({
      ok: true,
      card: {
        square_card_id: card.id,
        brand: card.cardBrand,
        last_4: card.last4,
        exp_month: card.expMonth,
        exp_year: card.expYear,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save card.";
    console.error("[Square] save card error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE { squareCardId } — remove a saved card
export async function DELETE(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { squareCardId } = await request.json();
    if (!squareCardId) return NextResponse.json({ error: "Missing card ID." }, { status: 400 });

    // Verify this card belongs to the user before deleting.
    const { data: card } = await sb
      .from("saved_cards")
      .select("id")
      .eq("user_id", user.id)
      .eq("square_card_id", squareCardId)
      .single();
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    // Disable in Square first.
    await sq().cards.disable(squareCardId);

    // Remove from our DB.
    await sb.from("saved_cards").delete().eq("square_card_id", squareCardId).eq("user_id", user.id);

    console.log(`[Square] card removed for user ${user.id}: ${squareCardId}`);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to remove card.";
    console.error("[Square] delete card error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
