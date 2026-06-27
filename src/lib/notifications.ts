import type { Order } from "@/types";

// ── Resend email to customer ──────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "orders@gswtools.com";

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
      subject: `Order Confirmed — ${order.order_number}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  console.log(`[Resend] Email sent to ${customerEmail} for ${order.order_number}`);
}

// ── Webhook to Pi inventory app ───────────────────────────────────────────────

export async function notifyInventoryApp(
  order: Order,
  customerEmail: string,
  customerName: string
): Promise<void> {
  const webhookUrl = process.env.INVENTORY_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes("YOUR_TAILSCALE_IP")) {
    console.warn("[Webhook] INVENTORY_WEBHOOK_URL not configured — skipping Pi notify");
    return;
  }

  const payload = {
    id: order.id,
    order_number: order.order_number,
    customer_email: customerEmail,
    customer_name: customerName,
    total: order.total,
    notes: order.notes,
    created_at: order.created_at,
    items: order.items.map((i) => ({
      item_id: i.item_id,
      name: i.name,
      sku: i.sku,
      unit_price: i.unit_price,
      quantity: i.quantity,
    })),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[Webhook] Pi returned ${res.status} for ${order.order_number}`);
    } else {
      console.log(`[Webhook] Pi notified for ${order.order_number}`);
    }
  } catch (err) {
    // Never block the order flow if the Pi is unreachable
    console.warn(`[Webhook] Could not reach Pi: ${err}`);
  } finally {
    clearTimeout(timer);
  }
}
