import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { sendStatusEmail } from "@/lib/notifications";
import type { Order } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // Only staff/admins can trigger status emails
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();
    if (error || !row) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const order: Order = { ...row, items: row.order_items };

    // Resolve the customer's email from auth.users via service role
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // Walk-in orders have no user account — nothing to email.
    if (!order.user_id) return NextResponse.json({ ok: true, skipped: "walk_in" });
    const { data: userRes } = await admin.auth.admin.getUserById(order.user_id);
    const email = userRes?.user?.email;
    const name = (userRes?.user?.user_metadata?.full_name as string) ?? "";
    if (!email) return NextResponse.json({ error: "No customer email" }, { status: 404 });

    await sendStatusEmail(order, email, name);

    // Notify shop inbox on cancellations and item_unavailable
    if (order.status === "cancelled" || order.status === "item_unavailable") {
      const { BRAND } = await import("@/lib/brand");
      const shopInbox = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
      if (apiKey) {
        const label = order.status === "cancelled" ? "Cancelled" : "Item Unavailable";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${BRAND.name} <${from}>`,
            to: [shopInbox],
            subject: `⚠ Order ${label} — ${order.order_number}`,
            html: `<p><strong>${order.order_number}</strong> was marked <strong>${label}</strong>.</p>
              <p>Customer: ${name || "—"} (${email})</p>
              <p>Total: $${order.total.toFixed(2)}</p>
              ${order.attention_note ? `<p>Note: ${order.attention_note}</p>` : ""}
              <p><a href="${BRAND.adminUrl}/orders">View in Admin</a></p>`,
          }),
        }).catch((e) => console.warn("[Resend] shop cancel notify failed:", e));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/orders/status-email]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
