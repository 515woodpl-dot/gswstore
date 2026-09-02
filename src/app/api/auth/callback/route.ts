import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth-security";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = request.nextUrl.origin;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const type = searchParams.get("type");

  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = type === "recovery" ? "/auth/update-password" : next;
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=confirmation_failed", origin));
}
