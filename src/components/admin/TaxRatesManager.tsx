"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  storeZip: string;
  uploadedAt: string | null;
  rowCount: number | null;
}

export default function TaxRatesManager({ storeZip, uploadedAt, rowCount }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [zip, setZip] = useState(storeZip);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; error?: string } | null>(null);
  const [savingZip, setSavingZip] = useState(false);
  const [lookupZip, setLookupZip] = useState("");
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setUploading(true);
    setProgress("Reading file…");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      setProgress(`Parsed ${lines.length.toLocaleString()} lines. Uploading to database…`);

      // Send in chunks of 50k lines to avoid request body limits
      const CHUNK_LINES = 50000;
      let totalInserted = 0;
      let totalSkipped = 0;

      for (let i = 0; i < lines.length; i += CHUNK_LINES) {
        const chunk = lines.slice(i, i + CHUNK_LINES);
        const pct = Math.round(((i + chunk.length) / lines.length) * 100);
        setProgress(`Uploading… ${pct}% (${(i + chunk.length).toLocaleString()} / ${lines.length.toLocaleString()} rows)`);

        const res = await fetch("/api/admin/tax-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: chunk.join("\n") }),
        });
        const json = await res.json();
        if (!res.ok) {
          setResult({ error: json.error || "Upload failed." });
          setUploading(false);
          return;
        }
        totalInserted += json.inserted ?? 0;
        totalSkipped += json.skipped ?? 0;
      }

      setResult({ inserted: totalInserted, skipped: totalSkipped });
      setProgress("");
      router.refresh();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveZip() {
    setSavingZip(true);
    await fetch("/api/admin/tax-rates/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: zip.trim() }),
    });
    setSavingZip(false);
    router.refresh();
  }

  async function lookup() {
    if (!lookupZip.trim() || lookupZip.length !== 5) return;
    setLookingUp(true);
    setLookupResult(null);
    const res = await fetch(`/api/admin/tax-rates?zip=${lookupZip.trim()}`);
    const json = await res.json();
    setLookupResult(json);
    setLookingUp(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Tax Rates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload the WA Department of Revenue ZIP+4 tax rate file each quarter. Rates are used automatically for walk-in and delivery orders.
      </p>

      {/* Store ZIP */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-950">Store ZIP code</h2>
        <p className="mt-1 text-sm text-slate-500">Your store's ZIP — used as the default tax rate for walk-in sales.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            maxLength={5}
            className="w-32 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono outline-none focus:border-brand-navy"
            placeholder="98198"
          />
          <button onClick={saveZip} disabled={savingZip || zip.length !== 5}
            className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
            {savingZip ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* Upload section */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-950">Upload rate file</h2>
          {uploadedAt && (
            <span className="text-xs text-slate-400">
              Last upload: {new Date(uploadedAt).toLocaleDateString()}
              {rowCount != null && ` · ${rowCount.toLocaleString()} rows`}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Download the quarterly ZIP+4 file from <strong>dor.wa.gov → Tax rates → Location codes and tax rates → ZIP+4</strong>. Upload it here each quarter.
        </p>

        <div className="mt-4">
          <label className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${uploading ? "border-slate-200 bg-slate-50" : "border-slate-300 hover:border-brand-navy hover:bg-slate-50"}`}>
            {uploading ? (
              <>
                <p className="text-3xl">⏳</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{progress}</p>
                <p className="mt-1 text-xs text-slate-400">Do not close this tab…</p>
              </>
            ) : (
              <>
                <p className="text-3xl">📄</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Click to choose the WA DOR .txt file</p>
                <p className="mt-1 text-xs text-slate-400">ZIP+4 rate file — e.g. Zip4RatesQ32026-Long.txt</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {result && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${result.error ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {result.error ? (
              <p>❌ {result.error}</p>
            ) : (
              <>
                <p className="font-bold">✅ Upload complete</p>
                <p>{result.inserted?.toLocaleString()} rates imported · {result.skipped?.toLocaleString()} rows skipped</p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Lookup tool */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-950">Look up a rate</h2>
        <p className="mt-1 text-sm text-slate-500">Verify the rate for any ZIP code in the database.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={lookupZip}
            onChange={(e) => setLookupZip(e.target.value)}
            maxLength={5}
            className="w-32 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono outline-none focus:border-brand-navy"
            placeholder="98198"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button onClick={lookup} disabled={lookingUp || lookupZip.length !== 5}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {lookingUp ? "Looking up…" : "Look up"}
          </button>
        </div>
        {lookupResult && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${lookupResult.error ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-slate-200 bg-slate-50"}`}>
            {lookupResult.error ? (
              <p>❌ {String(lookupResult.error)}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-bold text-slate-900">ZIP {lookupResult.zip as string}</p>
                <p>Combined rate: <strong>{((lookupResult.combined_rate as number) * 100).toFixed(2)}%</strong></p>
                <p className="text-slate-500">State: {((lookupResult.state_rate as number) * 100).toFixed(2)}% · Local: {((lookupResult.local_rate as number) * 100).toFixed(2)}%</p>
                {(lookupResult.rate_count as number) > 1 && (
                  <p className="text-xs text-amber-700">⚠ This ZIP has {lookupResult.rate_count as number} +4 suffix variants — showing most common rate.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p className="font-semibold">When to upload:</p>
        <p>WA DOR releases new rate files quarterly (Jan, Apr, Jul, Oct). Download from dor.wa.gov each quarter and re-upload here to stay current.</p>
      </div>
    </div>
  );
}
