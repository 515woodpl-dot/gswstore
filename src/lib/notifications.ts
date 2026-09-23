import type { Order } from "@/types";
import { BRAND } from "@/lib/brand";

// ── Resend email to customer ──────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  const replyTo = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;

  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY not set — skipping email");
    return;
  }

  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">$${(i.unit_price * i.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#1e3a5f;padding:28px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.4rem;font-weight:700">Order Confirmed</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:0.9rem">${order.order_number}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 20px;color:#374151">Hi ${customerName || "there"},<br><br>
    Your order has been received and is being prepared for pickup. We'll notify you when it's ready.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:0.8rem;color:#6b7280;font-weight:600">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:0.8rem;color:#6b7280;font-weight:600">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.8rem;color:#6b7280;font-weight:600">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb">
          <td colspan="2" style="padding:10px 12px;font-weight:700;color:#111827">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;font-size:1rem">$${order.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    ${order.notes ? `<p style="background:#f0f7ff;border-radius:6px;padding:12px 14px;font-size:0.85rem;color:#374151;margin-bottom:20px">
      <strong>Your note:</strong> ${order.notes}</p>` : ""}

    <div style="background:#f0f7ff;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <p style="margin:0;font-size:0.85rem;color:#1e40af">
        🏪 <strong>In-store pickup only.</strong><br>
        We'll send you another email when your order is ready for collection.
      </p>
    </div>

    <p style="margin:0;font-size:0.8rem;color:#9ca3af">
      Questions? Reply to this email or contact us directly.<br>
      ${BRAND.name}
    </p>
  </div>
</div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [customerEmail],
      reply_to: replyTo,
      subject: `Order Confirmed — ${order.order_number}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  console.log(`[Resend] Customer email sent to ${customerEmail} for ${order.order_number}`);

  // ── Notify the shop ────────────────────────────────────────────────────────
  // A copy goes to the shop inbox so staff see every order by email.
  await sendShopNotification(order, customerEmail, customerName).catch((e) =>
    console.warn("[Resend] Shop notification failed:", e)
  );
}

// ── Shop notification email ───────────────────────────────────────────────────

async function sendShopNotification(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  const shopInbox = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;
  if (!apiKey) return;

  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">$${(i.unit_price * i.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#1e3a5f;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.25rem;font-weight:700">🔔 New Order — ${order.order_number}</h1>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;font-size:0.9rem;color:#374151;margin-bottom:18px">
      <tr><td style="padding:4px 0;color:#6b7280">Customer</td><td style="padding:4px 0;text-align:right;font-weight:600">${customerName || "—"}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0;text-align:right">${customerEmail}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Placed</td><td style="padding:4px 0;text-align:right">${new Date(order.created_at).toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Fulfillment</td><td style="padding:4px 0;text-align:right;font-weight:600">${order.fulfillment === "delivery" ? "🚚 Delivery" : "🏪 Pickup"}</td></tr>
    </table>
    ${order.fulfillment === "delivery" ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:0.85rem;color:#92400e;margin-bottom:16px">
      <strong>Deliver to:</strong> ${order.delivery_address || "—"}
      ${order.total < 100 ? "<br><strong>⚠ Set delivery fee when processing (order under $100).</strong>" : "<br>Free delivery (order $100+)."}
    </div>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:10px 12px;text-align:left;font-size:0.8rem;color:#6b7280">Item</th>
        <th style="padding:10px 12px;text-align:center;font-size:0.8rem;color:#6b7280">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:0.8rem;color:#6b7280">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr style="background:#f9fafb">
        <td colspan="2" style="padding:10px 12px;font-weight:700">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700">$${order.total.toFixed(2)}</td>
      </tr></tfoot>
    </table>
    ${order.notes ? `<p style="background:#f0f7ff;border-radius:6px;padding:12px 14px;font-size:0.85rem;color:#374151;margin:0 0 16px"><strong>Note:</strong> ${order.notes}</p>` : ""}
    <a href="${BRAND.adminUrl}/orders" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:600;font-size:0.85rem;padding:10px 18px;border-radius:8px">View in Admin →</a>
  </div>
</div>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [shopInbox],
      reply_to: customerEmail,
      subject: `New Order ${order.order_number} — $${order.total.toFixed(2)}`,
      html,
    }),
  });

  if (res.ok) console.log(`[Resend] Shop notified at ${shopInbox} for ${order.order_number}`);
  else console.warn(`[Resend] Shop notify ${res.status}: ${await res.text()}`);
}

// ── Order status-change email to the customer ─────────────────────────────────

import { customerStatusMessage, orderStatusLabel, SHOP_PHONE, formatPrice } from "@/lib/utils";

export async function sendStatusEmail(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  const replyTo = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;
  if (!apiKey) { console.warn("[Resend] no key — skipping status email"); return; }

  if (order.status === "pending") return;

  const msg = customerStatusMessage(order.status, order.attention_note);
  const toneColor = { info:"#0369a1", success:"#047857", warning:"#b45309", muted:"#475569" }[msg.tone] ?? "#475569";
  const showCall = msg.tone === "warning";
  const phoneRaw = (process.env.NEXT_PUBLIC_SHOP_PHONE || "+12534496246").replace(/[^+\d]/g, "");

  const itemRows = order.items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:0.85rem;color:#374151">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:0.85rem;color:#374151">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:0.85rem;color:#374151">$${(i.unit_price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");

  const callBtn = showCall
    ? `<a href="tel:${phoneRaw}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem;padding:11px 20px;border-radius:8px;margin-bottom:20px">📞 Call ${SHOP_PHONE}</a>`
    : "";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#435d69;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.2rem;font-weight:700">${BRAND.name}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:0.85rem">Order ${order.order_number}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="display:inline-block;background:${toneColor};color:#fff;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:4px 12px;border-radius:9999px;margin-bottom:16px">${orderStatusLabel(order.status)}</div>
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:1.35rem">${msg.title}</h2>
    <p style="margin:0 0 20px;color:#374151;line-height:1.6">${msg.body}</p>
    ${callBtn}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:0.75rem;color:#6b7280;font-weight:600">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:0.75rem;color:#6b7280;font-weight:600">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.75rem;color:#6b7280;font-weight:600">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb">
          <td colspan="2" style="padding:10px 12px;font-weight:700;color:#111827;font-size:0.9rem">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;font-size:1rem">$${order.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin:0;font-size:0.78rem;color:#9ca3af">Questions? Call ${SHOP_PHONE} or email ${BRAND.orderEmail}</p>
  </div>
</div>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [customerEmail],
      reply_to: replyTo,
      subject: `${msg.title} — Order ${order.order_number}`,
      html,
    }),
  });
  if (res.ok) console.log(`[Resend] Status email (${order.status}) sent to ${customerEmail}`);
  else console.warn(`[Resend] Status email ${res.status}: ${await res.text()}`);
}

// ── Receipt email for completed in-store / walk-in / manual sales ────────────
interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  list_price?: number | null;
  discount_amount?: number;
}
interface ReceiptData {
  orderNumber: string;
  total: number;
  discountTotal?: number;
  items: ReceiptItem[];
  soldByName?: string;
  createdAt?: string;
  source?: string;
}

export async function sendReceiptEmail(
  receipt: ReceiptData,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  const replyTo = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;

  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY not set — skipping receipt email");
    return;
  }
  if (!customerEmail || !customerEmail.includes("@")) return; // no email, nothing to send

  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const itemRows = receipt.items
    .map((i) => {
      const disc = i.discount_amount && i.discount_amount > 0
        ? `<div style="font-size:0.75rem;color:#b45309">−$${i.discount_amount.toFixed(2)} discount</div>`
        : "";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.name}${disc}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">$${(i.unit_price * i.quantity).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const discountRow = receipt.discountTotal && receipt.discountTotal > 0
    ? `<tr><td colspan="2" style="padding:6px 12px;text-align:right;color:#b45309;font-size:0.85rem">Total savings</td>
       <td style="padding:6px 12px;text-align:right;color:#b45309;font-size:0.85rem">−$${receipt.discountTotal.toFixed(2)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#435d69;padding:24px 28px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:1.3rem;font-weight:700">Receipt</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:0.85rem">${receipt.orderNumber}</p>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 4px;color:#374151;font-size:0.9rem">${customerName ? `Hi ${customerName},` : "Thank you for your purchase!"}</p>
    <p style="margin:0 0 20px;color:#9ca3af;font-size:0.8rem">${dateStr}${receipt.soldByName ? ` · Served by ${receipt.soldByName}` : ""}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:0.8rem;color:#6b7280">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:0.8rem;color:#6b7280">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.8rem;color:#6b7280">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${discountRow}
        <tr style="background:#f9fafb">
          <td colspan="2" style="padding:10px 12px;font-weight:700;color:#111827">Total Paid</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;font-size:1.05rem">$${receipt.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin:0;font-size:0.78rem;color:#9ca3af;text-align:center">
      Thank you for shopping at ${BRAND.name}.<br>
      Questions? Reply to this email.
    </p>
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${BRAND.name} <${from}>`,
        to: customerEmail,
        reply_to: replyTo,
        subject: `Your receipt — ${receipt.orderNumber}`,
        html,
      }),
    });
    if (res.ok) console.log(`[Resend] Receipt sent to ${customerEmail} for ${receipt.orderNumber}`);
    else console.warn(`[Resend] Receipt failed ${res.status}`);
  } catch (e) {
    console.warn("[Resend] Receipt error:", e);
  }
}

// ── Admin-created payment-link order emails ──────────────────────────────────
// Shared wrapper — every email below is best-effort (never throws past this
// point uncaught) and uses the same envelope/branding as the rest of the app.
async function sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  if (!apiKey) { console.warn("[Resend] RESEND_API_KEY not set — skipping email:", subject); return; }
  if (!to || !to.includes("@")) { console.warn("[Resend] no recipient — skipping:", subject); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${BRAND.name} <${from}>`,
      to: [to],
      reply_to: replyTo || process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

function emailShell(headerLabel: string, orderNumber: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#1e3a5f;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.2rem;font-weight:700">${headerLabel}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:0.85rem">Order ${orderNumber}</p>
  </div>
  <div style="padding:28px 32px">${bodyHtml}</div>
</div>
</body></html>`;
}

function itemsTable(items: { name: string; quantity: number; unit_price: number }[]): string {
  const rows = items.map((i) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${formatPrice(i.unit_price * i.quantity)}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:18px">
    <thead><tr style="background:#f9fafb">
      <th style="padding:10px 12px;text-align:left;font-size:0.78rem;color:#6b7280">Item</th>
      <th style="padding:10px 12px;text-align:center;font-size:0.78rem;color:#6b7280">Qty</th>
      <th style="padding:10px 12px;text-align:right;font-size:0.78rem;color:#6b7280">Price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Section 3 & 25 — "Payment Request" / "Updated Payment Request" */
export async function sendPaymentRequestEmail(
  order: Order,
  customerEmail: string,
  customerName: string,
  paymentLinkUrl: string,
  isUpdate: boolean,
): Promise<void> {
  const totals = `<table width="100%" style="font-size:0.9rem;color:#374151;margin-bottom:20px">
      <tr><td style="padding:3px 0">Subtotal</td><td style="padding:3px 0;text-align:right">${formatPrice(order.subtotal ?? order.total)}</td></tr>
      ${order.discount_total ? `<tr><td style="padding:3px 0;color:#b45309">Discount</td><td style="padding:3px 0;text-align:right;color:#b45309">−${formatPrice(order.discount_total)}</td></tr>` : ""}
      ${order.tax_total ? `<tr><td style="padding:3px 0">Tax</td><td style="padding:3px 0;text-align:right">${formatPrice(order.tax_total)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;font-weight:700;font-size:1rem">Amount Due</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:1rem">${formatPrice(order.total)}</td></tr>
    </table>`;

  const updateBanner = isUpdate
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;font-size:0.85rem;color:#991b1b;margin-bottom:18px">
        <strong>This order has changed.</strong> Please use the new payment link below — any previous payment link for this order is no longer valid.
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 16px;color:#374151">Hi ${customerName || "there"}, please review your order below and complete payment to confirm it.</p>
    ${updateBanner}
    ${itemsTable(order.items)}
    ${totals}
    ${order.notes ? `<p style="background:#f0f7ff;border-radius:6px;padding:12px 14px;font-size:0.85rem;color:#374151;margin-bottom:20px"><strong>Note:</strong> ${order.notes}</p>` : ""}
    <a href="${paymentLinkUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:13px 28px;border-radius:10px">Review &amp; Pay →</a>
    <p style="margin:20px 0 0;font-size:0.78rem;color:#9ca3af">Questions? Reply to this email or call ${BRAND.phone}.</p>
  `;
  await sendEmail(
    customerEmail,
    `${isUpdate ? "Updated payment request" : "Payment requested"} — ${order.order_number} — ${formatPrice(order.total)}`,
    emailShell(isUpdate ? "Updated Payment Request" : "Payment Request", order.order_number, body),
  );
  console.log(`[Resend] Payment request (${isUpdate ? "update" : "new"}) sent to ${customerEmail} for ${order.order_number}`);
}

/** Section 17 — payment confirmation / lightweight invoice */
export async function sendPaymentLinkConfirmationEmail(order: Order, customerEmail: string, customerName: string): Promise<void> {
  const totals = `<table width="100%" style="font-size:0.9rem;color:#374151;margin-bottom:20px">
      <tr><td style="padding:3px 0">Subtotal</td><td style="padding:3px 0;text-align:right">${formatPrice(order.subtotal ?? order.total)}</td></tr>
      ${order.discount_total ? `<tr><td style="padding:3px 0;color:#b45309">Discount</td><td style="padding:3px 0;text-align:right;color:#b45309">−${formatPrice(order.discount_total)}</td></tr>` : ""}
      ${order.tax_total ? `<tr><td style="padding:3px 0">Tax</td><td style="padding:3px 0;text-align:right">${formatPrice(order.tax_total)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;font-weight:700;font-size:1rem">Amount Paid</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:1rem;color:#047857">${formatPrice(order.amount_paid ?? order.total)}</td></tr>
    </table>`;
  const body = `
    <p style="margin:0 0 16px;color:#374151">Hi ${customerName || "there"}, thanks — your payment for order ${order.order_number} was successful. We're preparing your order now and will email you when it's ready.</p>
    ${itemsTable(order.items)}
    ${totals}
    ${order.square_receipt_url ? `<a href="${order.square_receipt_url}" style="display:inline-block;color:#1e3a5f;font-size:0.85rem;font-weight:600;text-decoration:underline;margin-bottom:8px">View Square receipt →</a>` : ""}
    <p style="margin:16px 0 0;font-size:0.78rem;color:#9ca3af">Questions? Reply to this email or call ${BRAND.phone}.</p>
  `;
  await sendEmail(customerEmail, `Payment confirmed — ${order.order_number}`, emailShell("Payment Confirmed", order.order_number, body));
  console.log(`[Resend] Payment confirmation sent to ${customerEmail} for ${order.order_number}`);
}

/** Section 15 & 25 — "Order Updated" (items cancelled because unavailable, order unpaid or paid) */
export async function sendOrderUpdatedEmail(
  order: Order,
  customerEmail: string,
  customerName: string,
  cancelledItems: { name: string; cancelledQuantity: number; reason: string }[],
  refundAmount: number,
): Promise<void> {
  const cancelledRows = cancelledItems.map((i) => `<li style="margin-bottom:4px">${i.name} × ${i.cancelledQuantity}${i.reason ? ` — ${i.reason}` : ""}</li>`).join("");
  const remaining = order.items.filter((i) => i.status !== "cancelled" || (i.cancelled_quantity ?? 0) < i.quantity);
  const body = `
    <p style="margin:0 0 16px;color:#374151">Hi ${customerName || "there"}, one or more items on your order needed to be updated:</p>
    <ul style="margin:0 0 18px;padding-left:20px;color:#991b1b;font-size:0.9rem">${cancelledRows}</ul>
    ${remaining.length ? `<p style="margin:0 0 10px;font-weight:700;color:#0f172a;font-size:0.9rem">Remaining items</p>${itemsTable(remaining)}` : ""}
    <table width="100%" style="font-size:0.9rem;color:#374151;margin-bottom:20px">
      <tr><td style="padding:6px 0;font-weight:700">Updated Total</td><td style="padding:6px 0;text-align:right;font-weight:700">${formatPrice(order.total)}</td></tr>
      ${refundAmount > 0 ? `<tr><td style="padding:3px 0;color:#047857">Refunded</td><td style="padding:3px 0;text-align:right;color:#047857">${formatPrice(refundAmount)}</td></tr>` : ""}
    </table>
    <p style="margin:0;font-size:0.78rem;color:#9ca3af">Questions? Reply to this email or call ${BRAND.phone}.</p>
  `;
  await sendEmail(customerEmail, `Your order has been updated — ${order.order_number}`, emailShell("Order Updated", order.order_number, body));
  console.log(`[Resend] Order-updated email sent to ${customerEmail} for ${order.order_number}`);
}

/** Section 16 & 25 — partial or full refund confirmation */
export async function sendRefundEmail(
  order: Order,
  customerEmail: string,
  customerName: string,
  args: { refundedItemName?: string; refundAmount: number; remainingTotal: number; full: boolean; receiptUrl?: string | null },
): Promise<void> {
  const body = `
    <p style="margin:0 0 16px;color:#374151">Hi ${customerName || "there"}, ${args.full ? "your order has been cancelled and a refund has been issued." : `a refund has been issued for ${args.refundedItemName ?? "an item on your order"}.`}</p>
    <table width="100%" style="font-size:0.9rem;color:#374151;margin-bottom:20px">
      <tr><td style="padding:6px 0;font-weight:700;color:#047857">Refund Amount</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#047857">${formatPrice(args.refundAmount)}</td></tr>
      ${!args.full ? `<tr><td style="padding:6px 0">Remaining Order Total</td><td style="padding:6px 0;text-align:right">${formatPrice(args.remainingTotal)}</td></tr>` : ""}
    </table>
    ${args.receiptUrl ? `<a href="${args.receiptUrl}" style="display:inline-block;color:#1e3a5f;font-size:0.85rem;font-weight:600;text-decoration:underline;margin-bottom:8px">View refund receipt →</a>` : ""}
    <p style="margin:16px 0 0;font-size:0.78rem;color:#9ca3af">Refunds typically appear on your statement within 5–10 business days. Questions? Reply to this email or call ${BRAND.phone}.</p>
  `;
  await sendEmail(
    customerEmail,
    `${args.full ? "Order cancelled & refunded" : "Refund issued"} — ${order.order_number}`,
    emailShell(args.full ? "Order Cancelled & Refunded" : "Refund Issued", order.order_number, body),
  );
  console.log(`[Resend] Refund email sent to ${customerEmail} for ${order.order_number}`);
}

/** Section 10 & 25 — full order cancellation, no payment was ever taken */
export async function sendCancellationEmail(order: Order, customerEmail: string, customerName: string, reason: string): Promise<void> {
  const body = `
    <p style="margin:0 0 16px;color:#374151">Hi ${customerName || "there"}, your order has been cancelled${reason ? `: ${reason}` : "."}</p>
    <p style="margin:0;font-size:0.85rem;color:#6b7280">No payment was collected for this order. If you have questions, reply to this email or call ${BRAND.phone}.</p>
  `;
  await sendEmail(customerEmail, `Order cancelled — ${order.order_number}`, emailShell("Order Cancelled", order.order_number, body));
  console.log(`[Resend] Cancellation email sent to ${customerEmail} for ${order.order_number}`);
}
