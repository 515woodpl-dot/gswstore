import type { SupabaseClient } from "@supabase/supabase-js";

export function percentToTaxRate(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d{1,4})?$/.test(value.trim())) return null;
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 25 ? percent / 100 : null;
}

export async function getTaxZipOverride(client: SupabaseClient, zip: string): Promise<number | null> {
  const { data, error } = await client.from("store_settings").select("value").eq("key", `tax_zip_override_${zip}`).maybeSingle();
  if (error) throw new Error("Could not read the ZIP tax override.");
  if (!data) return null;
  const rate = Number(data.value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.25) throw new Error("The ZIP tax override is invalid.");
  return rate;
}
