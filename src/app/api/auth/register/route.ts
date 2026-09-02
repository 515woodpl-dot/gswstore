import { NextRequest, NextResponse } from "next/server";
import { allowAuthAttempt, clientIp, looksLikeBot } from "@/lib/auth-forms";
import { safeNextPath } from "@/lib/auth-security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rateKey = `register:${clientIp(request.headers)}`;
  if (looksLikeBot(body) || !allowAuthAttempt(rateKey)) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!name || !phone || !email.includes("@")) {
    return NextResponse.json({ error: "Enter your name, phone number, and a valid email address." }, { status: 400 });
  }
  if (password.length < 12) {
    return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
  }

  const next = safeNextPath(typeof body.next === "string" ? body.next : null);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, phone },
      emailRedirectTo: `${request.nextUrl.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return NextResponse.json({ error: "We could not create that account. Please try again later." }, { status: 400 });

  // Keep the response identical for new and existing email addresses.
  return NextResponse.json({ ok: true });
}
