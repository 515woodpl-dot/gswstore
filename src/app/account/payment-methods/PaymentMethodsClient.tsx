"use client";

import { useState } from "react";
import Link from "next/link";
import SquareCardForm from "@/components/SquareCardForm";

interface SavedCard {
  id: string;
  square_card_id: string;
  brand: string;
  last_4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string;
  created_at: string;
}

const BRAND_ICONS: Record<string, string> = {
  VISA: "💳",
  MASTERCARD: "💳",
  AMERICAN_EXPRESS: "💳",
  DISCOVER: "💳",
};

export default function PaymentMethodsClient({ initialCards }: { initialCards: SavedCard[] }) {
  const [cards, setCards] = useState<SavedCard[]>(initialCards);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // When Square card form "pays" $0.00 — we intercept here and use it to save.
  // We tokenize with intent STORE so Square knows this is a card-on-file action.
  async function onCardTokenized(cardholderName: string, token: string) {
    setError("");
    try {
      const res = await fetch("/api/square/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: token, cardholderName }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not save card."); return; }

      // Refresh card list.
      const listRes = await fetch("/api/square/cards");
      const listJson = await listRes.json();
      setCards(listJson.cards ?? []);
      setAdding(false);
      setSuccess("Card saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Could not save card. Please try again.");
    }
  }

  async function deleteCard(squareCardId: string) {
    if (!confirm("Remove this card from your account?")) return;
    setDeleting(squareCardId);
    try {
      const res = await fetch("/api/square/cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squareCardId }),
      });
      if (!res.ok) { setError("Could not remove card."); setDeleting(null); return; }
      setCards((prev) => prev.filter((c) => c.square_card_id !== squareCardId));
    } catch {
      setError("Could not remove card.");
    }
    setDeleting(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Account</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Payment Methods</h1>
        </div>
        <Link href="/account/orders" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          ← Orders
        </Link>
      </div>

      {success && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Saved cards list */}
      <div className="space-y-3">
        {cards.length === 0 && !adding && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-base font-semibold text-slate-950">No saved cards</p>
            <p className="mt-1 text-sm text-slate-500">Add a card to make checkout faster.</p>
          </div>
        )}

        {cards.map((card) => (
          <div key={card.square_card_id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{BRAND_ICONS[card.brand] ?? "💳"}</span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {card.brand} ···· {card.last_4}
                </p>
                <p className="text-xs text-slate-500">
                  Expires {card.exp_month}/{card.exp_year}
                  {card.cardholder_name && ` · ${card.cardholder_name}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => deleteCard(card.square_card_id)}
              disabled={deleting === card.square_card_id}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
            >
              {deleting === card.square_card_id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
      </div>

      {/* Add new card */}
      {adding ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-bold text-slate-950">Add a card</p>
            <button onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:text-slate-900">Cancel</button>
          </div>
          <SaveCardForm onSaved={onCardTokenized} />
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setError(""); }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-4 text-sm font-semibold text-slate-700 hover:border-brand-navy hover:text-brand-navy"
        >
          + Add a new card
        </button>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Your card details are stored securely by Square. We never see your full card number.
      </p>
    </div>
  );
}

// Separate inner component that uses Square's form to collect a card for storage.
function SaveCardForm({ onSaved }: { onSaved: (name: string, token: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useState<any>(null);

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  // We re-use the same Square card form logic but with intent=STORE.
  // For simplicity, we collect the token via SquareCardForm's onPaid callback
  // (which fires after tokenization — but we intercept at the API level to store instead of charge).
  // The payment amount here is $0 — we never actually charge.
  return (
    <div>
      <label className="mb-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-800">Cardholder name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on card"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-navy" />
      </label>
      {/* 
        We tokenize the card with $1 verification (Square requires a valid amount for CHARGE intent
        even for card-save purposes), but we do NOT complete a charge — the API route uses
        the token to create a card-on-file only. The $1 is a verification hold that releases immediately.
      */}
      <SquareCardFormStore cardholderName={name} onToken={(token) => onSaved(name, token)} />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

// Minimal Square form specifically for card storage — uses intent=STORE
function SquareCardFormStore({ cardholderName, onToken }: { cardholderName: string; onToken: (token: string) => void }) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cardInst = useState<any>(null);
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  const divId = "square-store-card-container";

  useState(() => {
    if (typeof window === "undefined") return;
    const SQUARE_SDK_URL = "https://sandbox.web.squarecdn.com/v1/square.js";
    async function init() {
      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${SQUARE_SDK_URL}"]`);
          if (existing) { resolve(); return; }
          const s = document.createElement("script");
          s.src = SQUARE_SDK_URL; s.onload = () => resolve(); s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      if (!window.Square || !appId || !locationId) return;
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card();
      await card.attach(`#${divId}`);
      cardInst[1](card);
      setReady(true);
    }
    init();
  });

  async function save() {
    if (!cardInst[0] || saving) return;
    setSaving(true); setError("");
    const result = await cardInst[0].tokenize({
      intent: "STORE",
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: cardholderName ? { givenName: cardholderName.split(" ")[0], familyName: cardholderName.split(" ").slice(1).join(" ") } : undefined,
    });
    if (result.status !== "OK" || !result.token) {
      setError(result.errors?.[0]?.message || "Card details are invalid.");
      setSaving(false); return;
    }
    onToken(result.token);
    setSaving(false);
  }

  return (
    <div>
      <div id={divId} className="rounded-2xl border border-slate-300 bg-white p-3" />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <button onClick={save} disabled={!ready || saving}
        className="mt-3 w-full rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        {saving ? "Saving…" : ready ? "Save card" : "Loading…"}
      </button>
    </div>
  );
}
