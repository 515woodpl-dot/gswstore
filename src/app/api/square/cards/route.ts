import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

const SQUARE_API = "https://connect.squareup.com/v2";

function sqHeaders() {
  return {
    "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-07-17",
  };
}

// GET — list saved cards for current user
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

// POST — save a new card
export async function POST(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sourceId, cardholderName } = await request.json();
    if (!sourceId) return NextResponse.json({ error: "Missing card token." }, { status: 400 });

    // Get or create Square Customer
    let squareCustomerId: string | undefined;
    const { data: profile } = await sb.from("profiles").select("square_customer_id").eq("id", user.id).single();
    squareCustomerId = profile?.square_customer_id ?? undefined;

    if (!squareCustomerId) {
      const custRes = await fetch(`${SQUARE_API}/customers`, {
        method: "POST",
        headers: sqHeaders(),
        body: JSON.stringify({
          idempotency_key: randomUUID(),
          email_address: user.email,
          note: `GSS user ${user.id}`,
        }),
      });
      const custData = await custRes.json();
      squareCustomerId = custData.customer?.id;
      if (!squareCustomerId) throw new Error("Failed to create Square customer.");
      await sb.from("profiles").update({ square_customer_id: squareCustomerId }).eq("id", user.id);
    }

    // Save card to Square Customer
    const cardRes = await fetch(`${SQUARE_API}/cards`, {
      method: "POST",
      headers: sqHeaders(),
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        source_id: sourceId,
        card: {
          customer_id: squareCustomerId,
          cardholder_name: cardholderName || user.email,
        },
      }),
    });
    const cardData = await cardRes.json();

    if (!cardRes.ok) {
      const msg = cardData.errors?.[0]?.detail ?? "Failed to save card.";
      console.warn("[Square] save card error:", msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const card = cardData.card;
    if (!card?.id) throw new Error("No card returned.");

    await sb.from("saved_cards").insert({
      user_id: user.id,
      square_card_id: card.id,
      brand: card.card_brand ?? "",
      last_4: card.last_4 ?? "",
      exp_month: card.exp_month ?? 0,
      exp_year: card.exp_year ?? 0,
      cardholder_name: cardholderName || "",
    });

    console.log(`[Square] card saved for user ${user.id}: ...${card.last_4}`);
    return NextResponse.json({ ok: true, card: { square_card_id: card.id, brand: card.card_brand, last_4: card.last_4, exp_month: card.exp_month, exp_year: card.exp_year } });

  } catch (err) {
    console.error("[Square] save card error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not save card. Please try again." }, { status: 500 });
  }
}

// DELETE — remove a saved card
export async function DELETE(request: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { squareCardId } = await request.json();
    if (!squareCardId) return NextResponse.json({ error: "Missing card ID." }, { status: 400 });

    const { data: card } = await sb.from("saved_cards").select("id").eq("user_id", user.id).eq("square_card_id", squareCardId).single();
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    await fetch(`${SQUARE_API}/cards/${squareCardId}/disable`, {
      method: "POST",
      headers: sqHeaders(),
    });

    await sb.from("saved_cards").delete().eq("square_card_id", squareCardId).eq("user_id", user.id);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[Square] delete card error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not remove card." }, { status: 500 });
  }
}
