"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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

const SQUARE_SDK_URL = "https://sandbox.web.squarecdn.com/v1/square.js";
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function AddCardForm({ onSaved }: { onSaved: () => void }) {
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!appId || !locationId) { setError("Card payments are not configured."); return; }
      if (!(window as any).Square) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${SQUARE_SDK_URL}"]`);
          if (existing) { resolve(); return; }
          const s = document.createElement("script");
          s.src = SQUARE_SDK_URL; s.onload = () => resolve(); s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      if (cancelled || !(window as any).Square) return;
      try {
        const payments = (window as any).Square.payments(appId, locationId);
        const card = await payments.card();
        await card.attach("#square-save-card-container");
        if (cancelled) return;
        cardRef.current = card;
        setReady(true);
      } catch {
        setError("Could not load the card form.");
      }
    }
    init();
    return () => { cancelled = true; };
  }, [appId, locationId]);

  function validateBilling(): string | null {
    if (!given.trim() || !family.trim()) return "Enter the cardholder's first and last name.";
    if (!line1.trim()) return "Enter the billing street address.";
    if (!city.trim()) return "Enter the billing city.";
    if (!state.trim()) return "Select the billing state.";
    if (!/^\d{5}(-\d{4})?$/.test(postal.trim())) return "Enter a valid billing ZIP code.";
    return null;
  }

  async function save() {
    if (!cardRef.current || saving) return;
    const billingError = validateBilling();
    if (billingError) { setError(billingError); return; }
    setSaving(true); setError("");

    try {
      const result = await cardRef.current.tokenize({
        intent: "STORE",
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: {
          givenName: given.trim(),
          familyName: family.trim(),
          addressLines: [line1.trim(), line2.trim()].filter(Boolean),
          city: city.trim(),
          state: state.trim(),
          postalCode: postal.trim(),
          countryCode: "US",
        },
      });
      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message || "Card details are invalid.");
        setSaving(false); return;
      }
      const res = await fetch("/api/square/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: result.token, cardholderName: `${given.trim()} ${family.trim()}` }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not save card."); setSaving(false); return; }
      onSaved();
      setSaving(false);
    } catch {
      setError("Could not save card. Please try again.");
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-navy";

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">Billing details</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={given} onChange={(e) => setGiven(e.target.value)} placeholder="First name" className={inputCls} autoComplete="given-name" />
        <input value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Last name" className={inputCls} autoComplete="family-name" />
      </div>
      <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" className={inputCls} autoComplete="address-line1" />
      <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt, suite (optional)" className={inputCls} autoComplete="address-line2" />
      <div className="grid grid-cols-[1fr_90px_110px] gap-2">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputCls} autoComplete="address-level2" />
        <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="ZIP" className={inputCls} autoComplete="postal-code" inputMode="numeric" />
      </div>
      <p className="pt-1 text-sm font-semibold text-slate-800">Card</p>
      <div id="square-save-card-container" className="rounded-2xl border border-slate-300 bg-white p-3" />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button onClick={save} disabled={!ready || saving}
        className="w-full rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        {saving ? "Saving card…" : ready ? "Save card" : "Loading…"}
      </button>
      <p className="text-center text-xs text-slate-400">Your card is stored securely by Square.</p>
    </div>
  );
}

export default function PaymentMethodsClient({ initialCards }: { initialCards: SavedCard[] }) {
  const [cards, setCards] = useState<SavedCard[]>(initialCards);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function refreshCards() {
    const res = await fetch("/api/square/cards");
    const json = await res.json();
    setCards(json.cards ?? []);
    setAdding(false);
    setSuccess("Card saved successfully.");
    setTimeout(() => setSuccess(""), 4000);
  }

  async function deleteCard(squareCardId: string) {
    if (!confirm("Remove this card from your account?")) return;
    setDeleting(squareCardId); setError("");
    try {
      const res = await fetch("/api/square/cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squareCardId }),
      });
      if (!res.ok) { setError("Could not remove card."); setDeleting(null); return; }
      setCards((prev) => prev.filter((c) => c.square_card_id !== squareCardId));
    } catch { setError("Could not remove card."); }
    setDeleting(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Account</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Payment Methods</h1>
        </div>
        <Link href="/account/orders" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">← Orders</Link>
      </div>
      {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✅ {success}</div>}
      {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
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
              <span className="text-2xl">💳</span>
              <div>
                <p className="text-sm font-bold text-slate-900">{card.brand} ···· {card.last_4}</p>
                <p className="text-xs text-slate-500">Expires {card.exp_month}/{card.exp_year}{card.cardholder_name ? ` · ${card.cardholder_name}` : ""}</p>
              </div>
            </div>
            <button onClick={() => deleteCard(card.square_card_id)} disabled={deleting === card.square_card_id}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50">
              {deleting === card.square_card_id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-bold text-slate-950">Add a card</p>
            <button onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:text-slate-900">Cancel</button>
          </div>
          <AddCardForm onSaved={refreshCards} />
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setError(""); }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-4 text-sm font-semibold text-slate-700 hover:border-brand-navy hover:text-brand-navy">
          + Add a new card
        </button>
      )}
    </div>
  );
}
