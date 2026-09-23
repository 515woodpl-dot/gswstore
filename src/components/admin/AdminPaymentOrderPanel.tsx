"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderEvent } from "@/types";

const ITEM_REASONS = [
  { value: "out_of_stock", label: "Out of stock" },
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "damaged", label: "Damaged" },
  { value: "inventory_error", label: "Inventory error" },
  { value: "customer_requested", label: "Customer requested cancellation" },
  { value: "duplicate_item", label: "Duplicate item" },
  { value: "incorrect_item", label: "Incorrect item" },
  { value: "other", label: "Other" },
];
const ORDER_REASONS = [
  { value: "customer_requested", label: "Customer requested cancellation" },
  { value: "items_unavailable", label: "Items unavailable" },
  { value: "inventory_issue", label: "Inventory issue" },
  { value: "duplicate_order", label: "Duplicate order" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "unable_to_fulfill", label: "Unable to fulfill" },
  { value: "other", label: "Other" },
];

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Unpaid", pending: "Pending", paid: "Paid",
  partially_refunded: "Partially Refunded", refunded: "Refunded", failed: "Payment Failed",
};
const PAYMENT_CLS: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-700", pending: "bg-amber-50 text-amber-800",
  paid: "bg-emerald-50 text-emerald-700", partially_refunded: "bg-amber-50 text-amber-800",
  refunded: "bg-rose-50 text-rose-700", failed: "bg-rose-50 text-rose-700",
};

export default function AdminPaymentOrderPanel({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [cancelItemDraft, setCancelItemDraft] = useState<{ itemId: string; qty: number } | null>(null);
  const [itemReason, setItemReason] = useState("out_of_stock");
  const [itemNote, setItemNote] = useState("");
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [orderReason, setOrderReason] = useState("customer_requested");
  const [orderNote, setOrderNote] = useState("");
  const [timeline, setTimeline] = useState<OrderEvent[] | null>(null);

  const isPaid = order.payment_status === "paid" || order.payment_status === "partially_refunded";

  async function post(url: string, body: unknown) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) { setMsg({ text: data.error || "Something went wrong.", ok: false }); setBusy(false); return null; }
      setMsg({ text: "Done.", ok: true });
      onChanged();
      return data;
    } catch {
      setMsg({ text: "Network error.", ok: false });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancelItem() {
    if (!cancelItemDraft) return;
    if (itemReason === "other" && !itemNote.trim()) { setMsg({ text: "Add a short note for \"Other\".", ok: false }); return; }
    const res = await post(`/api/admin/orders/${order.id}/cancel-item`, {
      orderItemId: cancelItemDraft.itemId, cancelQty: cancelItemDraft.qty, reason: itemReason, note: itemNote.trim(),
    });
    if (res) { setCancelItemDraft(null); setItemNote(""); }
  }

  async function confirmCancelOrder() {
    if (orderReason === "other" && !orderNote.trim()) { setMsg({ text: "Add a short note for \"Other\".", ok: false }); return; }
    const res = await post(`/api/admin/orders/${order.id}/cancel`, { reason: orderReason, note: orderNote.trim() });
    if (res) { setShowCancelOrder(false); setOrderNote(""); }
  }

  async function loadTimeline() {
    if (timeline) { setTimeline(null); return; }
    const res = await fetch(`/api/admin/orders/${order.id}/timeline`);
    const data = await res.json();
    setTimeline(data.events || []);
  }

  const activeItems = order.items.filter((i) => (i.cancelled_quantity ?? 0) < i.quantity);
  const canCancelItems = order.status !== "cancelled" && order.status !== "completed";

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {/* Payment / Square summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {order.is_test && <span className="rounded-full bg-violet-100 px-2.5 py-1 font-bold text-violet-700">Sandbox</span>}
        <span className={`rounded-full px-2.5 py-1 font-semibold ${PAYMENT_CLS[order.payment_status || "unpaid"]}`}>
          {PAYMENT_LABEL[order.payment_status || "unpaid"]}
        </span>
        {order.square_payment_link_status === "active" && order.square_payment_link_url && (
          <a href={order.square_payment_link_url} target="_blank" rel="noreferrer" className="font-semibold text-brand-navy underline">Payment link →</a>
        )}
        {order.square_receipt_url && (
          <a href={order.square_receipt_url} target="_blank" rel="noreferrer" className="font-semibold text-slate-600 underline">Square receipt →</a>
        )}
        {order.refund_failed_reason && (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-700">Refund failed: {order.refund_failed_reason}</span>
        )}
      </div>

      {/* Item-level actions */}
      {canCancelItems && activeItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cancel Item / Quantity</p>
          {activeItems.map((item) => {
            const remaining = item.quantity - (item.cancelled_quantity ?? 0);
            const draftHere = cancelItemDraft?.itemId === item.id;
            const oldCancelled = item.cancelled_quantity ?? 0;
            const previewQty = draftHere ? cancelItemDraft.qty : 1;
            const nextCancelled = oldCancelled + previewQty;
            const originalNetCents = Math.round((item.net_amount ?? item.unit_price * item.quantity) * 100);
            const originalTaxCents = Math.round((item.tax_amount ?? 0) * 100);
            const refundPreview = (
              Math.round(originalNetCents * nextCancelled / item.quantity) - Math.round(originalNetCents * oldCancelled / item.quantity)
              + Math.round(originalTaxCents * nextCancelled / item.quantity) - Math.round(originalTaxCents * oldCancelled / item.quantity)
            ) / 100;
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-slate-900">{item.name} × {remaining}</span>
                  {!draftHere && (
                    <button onClick={() => { setCancelItemDraft({ itemId: item.id, qty: 1 }); setItemReason("out_of_stock"); setItemNote(""); }}
                      className="shrink-0 text-xs font-semibold text-rose-600 hover:underline">Cancel…</button>
                  )}
                </div>
                {draftHere && (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Quantity to cancel</label>
                      <input type="number" min={1} max={remaining} value={cancelItemDraft.qty}
                        onChange={(e) => setCancelItemDraft({ ...cancelItemDraft, qty: Math.max(1, Math.min(remaining, Number(e.target.value))) })}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                    </div>
                    <select value={itemReason} onChange={(e) => setItemReason(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                      {ITEM_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {itemReason === "other" && (
                      <input value={itemNote} onChange={(e) => setItemNote(e.target.value)} placeholder="Short note"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    )}
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {isPaid
                        ? `This will issue a ${formatPrice(refundPreview)} refund through Square.`
                        : `Cancel ${cancelItemDraft.qty} × ${item.name}? A new payment link will be generated.`}
                    </div>
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={confirmCancelItem} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm Cancel</button>
                      <button onClick={() => setCancelItemDraft(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Back</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Order-level actions */}
      <div className="flex flex-wrap gap-2">
        {order.is_test && !isPaid && order.status === "awaiting_payment" && (
          <button disabled={busy} onClick={() => post(`/api/admin/orders/${order.id}/simulate-payment`, {})}
            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Simulate Payment</button>
        )}
        {order.square_payment_link_status === "active" && (
          <button disabled={busy} onClick={() => post("/api/admin/orders/payment-link/resend", { orderId: order.id })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Resend Payment Link</button>
        )}
        {!order.is_test && order.status === "awaiting_payment" && ["unpaid", "failed"].includes(order.payment_status || "unpaid") && order.square_payment_link_status !== "active" && (
          <button disabled={busy} onClick={() => post("/api/admin/orders/payment-link/resend", { orderId: order.id })}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Generate Payment Link</button>
        )}
        {isPaid && order.status === "awaiting_payment" && (
          <button disabled={busy} onClick={() => post(`/api/admin/orders/${order.id}/mark-processing`, {})}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Mark Processing</button>
        )}
        {isPaid && (order.status === "processing" || order.status === "awaiting_payment") && (
          <button disabled={busy} onClick={() => post(`/api/admin/orders/${order.id}/mark-ready`, {})}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50">Mark Ready</button>
        )}
        {order.status === "ready" && (
          <button disabled={busy} onClick={() => post(`/api/admin/orders/${order.id}/mark-completed`, {})}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Mark Completed</button>
        )}
        {order.status !== "cancelled" && order.status !== "completed" && !showCancelOrder && (
          <button onClick={() => setShowCancelOrder(true)} className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700">
            Cancel Entire Order
          </button>
        )}
        <button onClick={loadTimeline} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          {timeline ? "Hide" : "View"} Timeline
        </button>
      </div>

      {showCancelOrder && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          <select value={orderReason} onChange={(e) => setOrderReason(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {ORDER_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {orderReason === "other" && (
            <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Short note"
              className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          )}
          <div className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-rose-900">
            {isPaid ? `This will issue a full refund of ${formatPrice((order.amount_paid || 0) - (order.amount_refunded || 0))} through Square.` : "No payment has been collected — the order will simply be cancelled."}
          </div>
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={confirmCancelOrder} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm Cancellation</button>
            <button onClick={() => setShowCancelOrder(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Back</button>
          </div>
        </div>
      )}

      {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}

      {timeline && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs">
          {timeline.length === 0 && <p className="text-slate-400">No events yet.</p>}
          {timeline.map((ev) => (
            <div key={ev.id} className="border-b border-slate-100 py-1.5 last:border-0">
              <span className="font-semibold text-slate-800">{ev.event_type.replace(/_/g, " ")}</span>
              <span className="ml-2 text-slate-400">{new Date(ev.created_at).toLocaleString()}</span>
              {ev.actor_name && <span className="ml-2 text-slate-500">by {ev.actor_name}</span>}
              {ev.reason && <p className="text-slate-500">{ev.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
