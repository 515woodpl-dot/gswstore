import type { Order } from "@/types";

// ── Resend email to customer ──────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "orders@goldenstonetools.com";

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
      Golden Stone Tools
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
      reply_to: from,
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
  // A copy goes to orders@goldenstonetools.com so staff see every order by email.
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
  const from = process.env.RESEND_FROM || "orders@goldenstonetools.com";
  const shopInbox = process.env.SHOP_NOTIFY_EMAIL || "orders@goldenstonetools.com";
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
    </table>
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
    <a href="https://admin.goldenstonetools.com/orders" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:600;font-size:0.85rem;padding:10px 18px;border-radius:8px">View in Admin →</a>
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
  const from = process.env.RESEND_FROM || "orders@goldenstonetools.com";
  if (!apiKey) { console.warn("[Resend] no key — skipping status email"); return; }

  // Don't email on the very first pending state (they already got the confirmation)
  if (order.status === "pending") return;

  const msg = customerStatusMessage(order.status, order.attention_note);
  const toneColor = { info:"#0369a1", success:"#047857", warning:"#b45309", muted:"#475569" }[msg.tone];

  const showCall = msg.tone === "warning";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#1e3a5f;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.2rem;font-weight:700">Golden Stone Tools</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:0.85rem">Order ${order.order_number}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="display:inline-block;background:${toneColor};color:#fff;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:4px 12px;border-radius:9999px;margin-bottom:16px">${orderStatusLabel(order.status)}</div>
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:1.35rem">${msg.title}</h2>
    <p style="margin:0 0 20px;color:#374151;line-height:1.6">${msg.body}</p>
    ${showCall ? `<a href="tel:${(process.env.NEXT_PUBLIC_SHOP_PHONE||"+12534496246").replace(/[^+\\d]/g,"")}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem;padding:11px 20px;border-radius:8px;margin-bottom:8px">📞 Call ${SHOP_PHONE}</a>` : ""}
    <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px">
      <p style="margin:0 0 4px;font-size:0.8rem;color:#6b7280">Order total</p>
      <p style="margin:0;font-size:1.1rem;font-weight:700;color:#0f172a">${formatPrice(order.total)}</p>
    </div>
    <p style="margin:20px 0 0;font-size:0.78rem;color:#9ca3af">Questions? Call ${SHOP_PHONE} or reply to this email.</p>
  </div>
</div>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [customerEmail],
      reply_to: from,
      subject: `${msg.title} — Order ${order.order_number}`,
      html,
    }),
  });
  if (res.ok) console.log(`[Resend] Status email (${order.status}) sent to ${customerEmail}`);
  else console.warn(`[Resend] Status email ${res.status}: ${await res.text()}`);
}
