import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PaymentMethodsClient from "./PaymentMethodsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment Methods" };

export default async function PaymentMethodsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/account/payment-methods");

  const { data: cards } = await sb
    .from("saved_cards")
    .select("id,square_card_id,brand,last_4,exp_month,exp_year,cardholder_name,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <PaymentMethodsClient initialCards={cards ?? []} />;
}
