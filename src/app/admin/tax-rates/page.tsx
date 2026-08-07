import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import TaxRatesManager from "@/components/admin/TaxRatesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tax Rates — Admin" };

export default async function TaxRatesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/auth/login?next=/admin/tax-rates");
    redirect("/?error=not_authorized");
  }

  const sb = await createClient();

  // Load current settings
  const { data: settings } = await sb
    .from("store_settings")
    .select("key,value")
    .in("key", ["store_zip", "tax_rates_uploaded_at", "tax_rates_row_count"]);

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value])
  );

  return (
    <TaxRatesManager
      storeZip={settingsMap.store_zip ?? ""}
      uploadedAt={settingsMap.tax_rates_uploaded_at ?? null}
      rowCount={settingsMap.tax_rates_row_count ? Number(settingsMap.tax_rates_row_count) : null}
    />
  );
}
