"use client";

import { useEffect, useRef, useState } from "react";

// Square Web Payments SDK is loaded from Square's CDN and attaches to window.Square.
// Sandbox script; swap to https://web.squarecdn.com/v1/square.js for production.
const SQUARE_SDK_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

interface SquareCardFormProps {
  amountCents: number;
  onPaid: (paymentId: string) => void; // called after a successful charge
  disabled?: boolean;
}

// Minimal typings for the bits of the SDK we use.
interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
}
interface SquarePayments {
  card: () => Promise<SquareCard>;
}
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

export default function SquareCardForm({ amountCents, onPaid, disabled }: SquareCardFormProps) {
  const cardRef = useRef<SquareCard | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!appId || !locationId) { setError("Card payments are not configured."); return; }

      // Load the SDK script once.
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

  async function handlePay() {
    if (!cardRef.current || processing || disabled) return;
    setProcessing(true); setError("");
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message || "Card details are invalid.");
        setProcessing(false);
        return;
      }
      // Charge server-side.
      const res = await fetch("/api/square/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: result.token, amountCents }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Payment failed.");
        setProcessing(false);
        return;
      }
      onPaid(json.paymentId);
    } catch {
      setError("Payment failed. Please try again.");
      setProcessing(false);
    }
  }

  return (
    <div>
      <div id="square-card-container" className="rounded-2xl border border-slate-300 bg-white p-3" />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || processing || disabled}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        {processing ? "Processing payment…" : ready ? `Pay $${(amountCents / 100).toFixed(2)}` : "Loading card form…"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">Secured by Square. Sandbox test mode.</p>
    </div>
  );
}
