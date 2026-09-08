import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

// GET /api/test-email — sends a test email and returns full diagnostics
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@orders.stoneproductsupply.com";
  const to = process.env.SHOP_NOTIFY_EMAIL || BRAND.orderEmail;

  const diagnostics: Record<string, unknown> = {
    RESEND_API_KEY_SET: !!apiKey,
    RESEND_API_KEY_PREFIX: apiKey ? apiKey.slice(0, 6) + "..." : "NOT SET",
    RESEND_FROM: from,
    SHOP_NOTIFY_EMAIL: to,
  };

  if (!apiKey) {
    return NextResponse.json({ ...diagnostics, error: "RESEND_API_KEY not set" });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${BRAND.name} <${from}>`,
        to: [to],
        subject: "🔧 SPS Test Email",
        html: `<p>This is a test email from Stone Product Supply.</p><p>If you see this, Resend is working.</p><p>Sent at: ${new Date().toISOString()}</p>`,
      }),
    });

    const body = await res.text();
    diagnostics.resend_status = res.status;
    diagnostics.resend_response = body;
    diagnostics.success = res.ok;

    return NextResponse.json(diagnostics);
  } catch (err) {
    diagnostics.fetch_error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(diagnostics);
  }
}
