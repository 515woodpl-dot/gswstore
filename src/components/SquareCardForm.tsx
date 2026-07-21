"use client";

import { useEffect, useRef, useState } from "react";

const SQUARE_SDK_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

interface SquareCardFormProps {
  amountCents: number;
  onPaid: (paymentId: string) => void;
  disabled?: boolean;
}

interface TokenizeOptions {
  billingContact?: {
    givenName?: string;
    familyName?: string;
    addressLines?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
}
interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: (opts?: TokenizeOptions) => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
}
interface SquarePayments {
  card: () => Promise<SquareCard>;
}
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export default function SquareCardForm({ amountCents, onPaid, disabled }: SquareCardFormProps) {
  const cardRef = useRef<SquareCard | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
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
      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${SQUARE_SDK_URL}"]`);
          if (existing) { existing.addEventListener("load", () => resolve()); return; }
          const s = document.createElement("script");
          s.src = SQUARE_SDK_URL;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Square."));
          document.head.appendChild(s);
        });
      }
      if (cancelled || !window.Square) return;
      try {
        const payments = window.Square.payments(appId, locationId);
        const card = await payments.card();
        await card.attach("#square-card-container");
        if (cancelled) return;
        cardRef.current = card;
        setReady(true);
      } catch {
        setError("Could not load the card form. Refresh and try again.");
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

  async function handlePay() {
    if (!cardRef.current || processing || disabled) return;
    const billingError = validateBilling();
    if (billingError) { setError(billingError); return; }

    setProcessing(true); setError("");
    try {
      const result = await cardRef.current.tokenize({
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
        setProcessing(false);
        return;
      }
      const res = await fetch("/api/square/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: result.token,
          amountCents,
          billing: {
            name: `${given.trim()} ${family.trim()}`,
            line1: line1.trim(), line2: line2.trim(),
            city: city.trim(), state: state.trim(), postalCode: postal.trim(),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Payment failed."); setProcessing(false); return; }
      onPaid(json.paymentId);
    } catch {
      setError("Payment failed. Please try again.");
      setProcessing(false);
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
        <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls} autoComplete="address-level1">
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="ZIP" className={inputCls} autoComplete="postal-code" inputMode="numeric" />
      </div>

      <p className="pt-1 text-sm font-semibold text-slate-800">Card</p>
      <div id="square-card-container" className="rounded-2xl border border-slate-300 bg-white p-3" />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || processing || disabled}
        className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        {processing ? "Processing payment…" : ready ? `Pay $${(amountCents / 100).toFixed(2)}` : "Loading card form…"}
      </button>
      <p className="text-center text-xs text-slate-400">Secured by Square. Sandbox test mode.</p>
    </div>
  );
}
