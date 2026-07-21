import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { SquareClient, SquareEnvironment } from "square";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function sq() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Sandbox, // switch to Production when going live
  });
}

export async function DELETE() {
  try {
    // Verify the user is authenticated.
    const sb = await createUserClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    // 1. Disable any saved Square cards so they can't be charged.
    const { data: cards } = await sb
      .from("saved_cards")
      .select("square_card_id")
      .eq("user_id", user.id);

    if (cards && cards.length > 0) {
      await Promise.allSettled(
        cards.map((c) => sq().cards.disable(c.square_card_id).catch(() => {}))
      );
    }

    // 2. Delete all user data from our tables (cascades handle most of it,
    //    but being explicit is safer and faster than relying on FK cascades).
    await Promise.allSettled([
      admin.from("saved_cards").delete().eq("user_id", user.id),
      admin.from("reviews").delete().eq("user_id", user.id),
      admin.from("cart_items").delete().eq(
        "cart_id",
        admin.from("carts").select("id").eq("user_id", user.id)
      ),
    ]);

    // Delete cart
    await admin.from("carts").delete().eq("user_id", user.id);

    // 3. Anonymize orders so order history stays intact but PII is gone.
    //    We set user_id to NULL so the orders no longer link to any account.
    await admin.from("orders").update({ user_id: null }).eq("user_id", user.id);

    // 4. Delete the profile row.
    await admin.from("profiles").delete().eq("id", user.id);

    // 5. Sign the user out locally before deletion.
    await sb.auth.signOut();

    // 6. Hard-delete the auth user — this is the point of no return.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error("[Account] deleteUser error:", deleteErr.message);
      return NextResponse.json({ error: "Could not delete account. Please contact support." }, { status: 500 });
    }

    console.log(`[Account] user ${user.id} (${user.email}) deleted their account`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Account] delete error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Something went wrong. Please try again or contact support." }, { status: 500 });
  }
}
