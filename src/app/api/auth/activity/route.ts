import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Middleware refreshes the signed activity marker for authenticated requests.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return new NextResponse(null, { status: 204 });
}
