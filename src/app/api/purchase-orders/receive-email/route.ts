import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { poId } = await request.json();
    if (!poId) return NextResponse.json({ error: "Missing poId" }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const sb = await createClient();

    const { data: po } = await sb
      .from("purchase_orders")
      .select("*, po_items(*, inventory:item_id(name,sku,store_price))")
      .eq("id", poId)
      .single();
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
    const shopInbox = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;
    if (!apiKey) return NextResponse.json({ error: "No email key" }, { status: 500 });

    const extras = Number(po.freight) + Number(po.tariffs) + Number(po.handling);

    const itemRows = (po.po_items ?? []).map((item: {
      item_name: string; quantity: number; unit_cost: number; landed_cost: number;
      inventory?: { name: string; sku: string; store_price: number } | null;
    }) => {
      const inv = item.inventory;
      const msrp = inv?.store_price ? `$${Number(inv.store_price).toFixed(2)}` : "—";
      const margin = inv?.store_price && item.landed_cost > 0
        ? `${(((Number(inv.store_price) - item.landed_cost) / Number(inv.store_price)) * 100).toFixed(0)}%`
        : "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:0.85rem">${item.item_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:0.85rem">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:0.85rem">$${Number(item.unit_cost).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:0.85rem;font-weight:700;color:#047857">$${Number(item.landed_cost).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:0.85rem">${msrp}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:0.85rem">${margin}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
<div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#047857;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:1.25rem;font-weight:700">📦 Stock Received — ${po.po_number}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:0.85rem">${po.supplier_name} · ${new Date().toLocaleDateString()}</p>
  </div>
  <div style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:0.75rem;color:#6b7280;font-weight:600">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:0.75rem;color:#6b7280;font-weight:600">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.75rem;color:#6b7280;font-weight:600">Unit Cost</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.75rem;color:#6b7280;font-weight:600">Landed Cost</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.75rem;color:#6b7280;font-weight:600">MSRP</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.75rem;color:#6b7280;font-weight:600">Margin</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <table style="width:100%;font-size:0.85rem;color:#374151">
        <tr><td>Items subtotal</td><td style="text-align:right;font-weight:600">$${Number(po.subtotal).toFixed(2)}</td></tr>
        ${Number(po.freight) > 0 ? `<tr><td>Freight</td><td style="text-align:right">$${Number(po.freight).toFixed(2)}</td></tr>` : ""}
        ${Number(po.tariffs) > 0 ? `<tr><td>Tariffs</td><td style="text-align:right">$${Number(po.tariffs).toFixed(2)}</td></tr>` : ""}
        ${Number(po.handling) > 0 ? `<tr><td>Handling</td><td style="text-align:right">$${Number(po.handling).toFixed(2)}</td></tr>` : ""}
        ${extras > 0 ? `<tr style="border-top:1px solid #bbf7d0"><td style="padding-top:6px;font-weight:700">Landed Total</td><td style="padding-top:6px;text-align:right;font-weight:700;font-size:1rem">$${Number(po.landed_total).toFixed(2)}</td></tr>` : ""}
      </table>
    </div>

    ${po.notes ? `<p style="background:#f0f7ff;border-radius:6px;padding:12px 14px;font-size:0.85rem;color:#374151"><strong>Notes:</strong> ${po.notes}</p>` : ""}

    <p style="margin:16px 0 0;font-size:0.78rem;color:#9ca3af">
      Inventory quantities and cost prices have been updated automatically.<br>
      ${BRAND.name}
    </p>
  </div>
</div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${BRAND.name} <${from}>`,
        to: [shopInbox],
        subject: `📦 Stock Received — ${po.po_number} — $${Number(po.landed_total).toFixed(2)}`,
        html,
      }),
    });

    if (res.ok) {
      console.log(`[Resend] PO receive email sent for ${po.po_number}`);
      return NextResponse.json({ ok: true });
    } else {
      const body = await res.text();
      console.warn(`[Resend] PO email ${res.status}: ${body}`);
      return NextResponse.json({ error: `Email failed: ${res.status}` }, { status: 500 });
    }
  } catch (err) {
    console.error("[PO email] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
