"use client";

import { useState } from "react";

export type BuyerType = "personal" | "company";
export type PaymentMethod = "cash" | "zelle" | "square";
export type ResellerDecision = "" | "approved" | "charge_tax";

export interface SaleComplianceValue {
  buyerType: BuyerType | "";
  paymentMethod: PaymentMethod | "";
  taxZip: string;
  taxCity: string;
  resellerDecision: ResellerDecision;
  resellerPermitPath: string;
  resellerPermitFilename: string;
}

export const emptySaleCompliance: SaleComplianceValue = {
  buyerType: "", paymentMethod: "", taxZip: "", taxCity: "",
  resellerDecision: "", resellerPermitPath: "", resellerPermitFilename: "",
};

export default function SaleComplianceFields({
  value, onChange, onTaxRate, fixedPaymentMethod,
}: {
  value: SaleComplianceValue;
  onChange: (next: SaleComplianceValue) => void;
  onTaxRate?: (rate: number) => void;
  fixedPaymentMethod?: PaymentMethod;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [taxStatus, setTaxStatus] = useState("");

  function patch(next: Partial<SaleComplianceValue>) {
    onChange({ ...value, ...next });
  }

  async function lookupZip(zip: string) {
    patch({ taxZip: zip });
    if (!/^\d{5}$/.test(zip)) { onTaxRate?.(0); setTaxStatus(""); return; }
    setTaxStatus("Looking up…");
    try {
      const response = await fetch(`/api/admin/tax-rates?zip=${zip}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No rate found");
      const rate = Number(data.combined_rate) || 0;
      onTaxRate?.(rate);
      setTaxStatus(`${(rate * 100).toFixed(2)}% rate`);
    } catch (error) {
      onTaxRate?.(0);
      setTaxStatus(error instanceof Error ? error.message : "No rate found");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setUploadError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/admin/reseller-permits", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      patch({ resellerPermitPath: data.path, resellerPermitFilename: data.filename, resellerDecision: "" });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  const selectCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Sale compliance (required)</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-xs font-semibold text-slate-700">Purchase for</span>
          <select value={value.buyerType} onChange={(e) => patch({ buyerType: e.target.value as BuyerType, resellerDecision: "", resellerPermitPath: "", resellerPermitFilename: "" })} className={selectCls}>
            <option value="">Choose…</option><option value="personal">Personal use</option><option value="company">Company</option>
          </select>
        </label>
        <label><span className="mb-1 block text-xs font-semibold text-slate-700">Transaction type</span>
          {fixedPaymentMethod ? (
            <div className={`${selectCls} bg-slate-50 font-semibold`}>Square Up</div>
          ) : (
            <select value={value.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value as PaymentMethod })} className={selectCls}>
              <option value="">Choose…</option><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="square">Square Up</option>
            </select>
          )}
        </label>
        <label><span className="mb-1 block text-xs font-semibold text-slate-700">Tax city</span>
          <input value={value.taxCity} onChange={(e) => patch({ taxCity: e.target.value })} placeholder="Auburn" className={selectCls} />
        </label>
        <label><span className="mb-1 block text-xs font-semibold text-slate-700">Tax ZIP</span>
          <div className="flex items-center gap-2"><input value={value.taxZip} onChange={(e) => void lookupZip(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="98002" className={selectCls} /><span className="shrink-0 text-xs text-slate-500">{taxStatus}</span></div>
        </label>
      </div>

      {value.buyerType === "company" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-950">Reseller permit required</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">Upload the permit, review it, then approve tax exemption or charge the normal ZIP-based tax.</p>
          <label className="mt-3 block text-sm font-semibold text-slate-800">
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => void upload(e.target.files?.[0])} disabled={uploading} className="block w-full text-xs" />
          </label>
          {uploading && <p className="mt-2 text-xs text-slate-600">Uploading permit…</p>}
          {uploadError && <p className="mt-2 text-xs font-semibold text-rose-700">{uploadError}</p>}
          {value.resellerPermitPath && (
            <div className="mt-3 space-y-2">
              <a href={`/api/admin/reseller-permits?path=${encodeURIComponent(value.resellerPermitPath)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-navy underline">Review {value.resellerPermitFilename || "uploaded permit"} →</a>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-lg border p-2 text-xs ${value.resellerDecision === "approved" ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white"}`}><input type="radio" name={`permit-${value.resellerPermitPath}`} checked={value.resellerDecision === "approved"} onChange={() => patch({ resellerDecision: "approved" })} /> <strong>Approve permit</strong><span className="block pl-5 text-slate-600">Tax exempt</span></label>
                <label className={`cursor-pointer rounded-lg border p-2 text-xs ${value.resellerDecision === "charge_tax" ? "border-orange-400 bg-orange-50" : "border-slate-300 bg-white"}`}><input type="radio" name={`permit-${value.resellerPermitPath}`} checked={value.resellerDecision === "charge_tax"} onChange={() => patch({ resellerDecision: "charge_tax" })} /> <strong>Do not approve</strong><span className="block pl-5 text-slate-600">Charge normal tax</span></label>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
