"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CloseAccountProps {
  hasPendingOrders: boolean;
  userEmail: string;
}

export default function CloseAccount({ hasPendingOrders, userEmail }: CloseAccountProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirmed = confirm.trim().toLowerCase() === "delete my account";

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true); setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not close account."); setDeleting(false); return; }
      // Account deleted — redirect to home with a message.
      router.push("/?account=closed");
    } catch {
      setError("Something went wrong. Please try again or contact support.");
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-12 border-t border-slate-100 pt-8">
        <h2 className="text-base font-bold text-slate-950">Close account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Close my account
        </button>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <h2 className="text-base font-bold text-rose-900">Close your account</h2>

      {/* Pending order warning */}
      {hasPendingOrders && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">⚠ You have active orders</p>
          <p className="mt-1">
            You have one or more orders that are pending or being prepared. If you close your account
            now, staff will still fulfill them — but you won't be able to track them or receive
            status updates. Contact us first if you need to cancel an order.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm text-rose-800">
        <p>Closing your account will permanently:</p>
        <ul className="ml-4 list-disc space-y-1 text-rose-700">
          <li>Delete your login and profile</li>
          <li>Remove all saved payment cards from your account</li>
          <li>Delete your cart and saved reviews</li>
          <li>Unlink your order history (orders are kept for our records but not tied to you)</li>
        </ul>
        <p className="font-semibold">This cannot be undone.</p>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold text-rose-900">
          Type <span className="font-mono font-bold">delete my account</span> to confirm
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="delete my account"
          className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500"
        />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleDelete}
          disabled={!confirmed || deleting}
          className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
        <button
          onClick={() => { setOpen(false); setConfirm(""); setError(""); }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
