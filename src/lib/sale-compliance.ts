import type { SupabaseClient } from "@supabase/supabase-js";
import { SaleCreationError } from "@/lib/create-sale";

export type BuyerType = "personal" | "company";
export type PaymentMethod = "cash" | "zelle" | "square";
export type ResellerPermitStatus = "not_required" | "approved" | "rejected";

export interface SaleCompliance {
  buyerType: BuyerType;
  paymentMethod: PaymentMethod;
  taxZip: string;
  taxCity: string;
  taxRate: number;
  taxExempt: boolean;
  resellerPermitStatus: ResellerPermitStatus;
  resellerPermitPath: string | null;
  resellerPermitFilename: string;
}

export async function resolveSaleCompliance(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  fixedPaymentMethod?: PaymentMethod,
): Promise<SaleCompliance> {
  const buyerType = body.buyerType === "company" ? "company" : body.buyerType === "personal" ? "personal" : null;
  if (!buyerType) throw new SaleCreationError("Choose whether this purchase is personal or for a company.", 400);

  const paymentMethod = fixedPaymentMethod ?? (
    body.paymentMethod === "cash" || body.paymentMethod === "zelle" || body.paymentMethod === "square"
      ? body.paymentMethod
      : null
  );
  if (!paymentMethod) throw new SaleCreationError("Choose Cash, Zelle, or Square Up as the transaction type.", 400);

  const taxZip = typeof body.taxZip === "string" ? body.taxZip.trim() : "";
  const taxCity = typeof body.taxCity === "string" ? body.taxCity.trim() : "";
  if (!/^\d{5}$/.test(taxZip)) throw new SaleCreationError("Enter the 5-digit ZIP used for sales tax.", 400);
  if (!taxCity || taxCity.length > 120) throw new SaleCreationError("Enter the city used for sales tax.", 400);

  let taxExempt = false;
  let resellerPermitStatus: ResellerPermitStatus = "not_required";
  let resellerPermitPath: string | null = null;
  let resellerPermitFilename = "";

  if (buyerType === "company") {
    resellerPermitPath = typeof body.resellerPermitPath === "string" ? body.resellerPermitPath.trim() : null;
    resellerPermitFilename = typeof body.resellerPermitFilename === "string" ? body.resellerPermitFilename.trim().slice(0, 255) : "";
    if (!resellerPermitPath || !/^permits\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[^/]+$/i.test(resellerPermitPath)) {
      throw new SaleCreationError("Upload the company's reseller permit before completing the sale.", 400);
    }
    const { data: permitObject } = await admin.storage.from("reseller-permits").list(
      resellerPermitPath.slice(0, resellerPermitPath.lastIndexOf("/")),
      { search: resellerPermitPath.slice(resellerPermitPath.lastIndexOf("/") + 1), limit: 1 },
    );
    if (!permitObject?.some((object) => `${resellerPermitPath!.slice(0, resellerPermitPath!.lastIndexOf("/") + 1)}${object.name}` === resellerPermitPath)) {
      throw new SaleCreationError("The reseller permit upload could not be verified. Upload it again.", 409);
    }
    if (body.resellerDecision === "approved") {
      taxExempt = true;
      resellerPermitStatus = "approved";
    } else if (body.resellerDecision === "charge_tax") {
      resellerPermitStatus = "rejected";
    } else {
      throw new SaleCreationError("Review the reseller permit, then approve the exemption or charge sales tax.", 400);
    }
  }

  let taxRate = 0;
  if (!taxExempt) {
    const { data: rates, error } = await admin.from("tax_rates").select("combined_rate").eq("zip", taxZip);
    if (error || !rates?.length) throw new SaleCreationError("No sales-tax rate was found for that ZIP.", 409);
    const frequency = new Map<string, number>();
    for (const row of rates) {
      const key = String(row.combined_rate);
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
    taxRate = Number([...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 0.25) {
      throw new SaleCreationError("The configured sales-tax rate is invalid.", 500);
    }
  }

  return {
    buyerType, paymentMethod, taxZip, taxCity, taxRate, taxExempt,
    resellerPermitStatus, resellerPermitPath, resellerPermitFilename,
  };
}

export function complianceOrderValues(compliance: SaleCompliance, reviewerId: string) {
  const reviewed = compliance.buyerType === "company";
  return {
    buyer_type: compliance.buyerType,
    payment_method: compliance.paymentMethod,
    tax_zip: compliance.taxZip,
    tax_city: compliance.taxCity,
    tax_exempt: compliance.taxExempt,
    reseller_permit_status: compliance.resellerPermitStatus,
    reseller_permit_path: compliance.resellerPermitPath,
    reseller_permit_filename: compliance.resellerPermitFilename,
    reseller_permit_uploaded_at: compliance.resellerPermitPath ? new Date().toISOString() : null,
    reseller_permit_reviewed_at: reviewed ? new Date().toISOString() : null,
    reseller_permit_reviewed_by: reviewed ? reviewerId : null,
  };
}
