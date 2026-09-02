import { NextRequest, NextResponse } from "next/server";
import { allowAuthAttempt, clientIp, looksLikeBot } from "@/lib/auth-forms";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rateKey = `password-reset:${clientIp(request.headers)}`;
  if (looksLikeBot(body) || !allowAuthAttempt(rateKey, 3)) {
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${request.nextUrl.origin}/api/auth/callback?next=/auth/update-password&type=recovery`,
  });

  // Avoid revealing whether an account exists for an email address.
  return NextResponse.json({ ok: true });
}
