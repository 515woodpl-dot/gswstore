import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

// POST — upload WA DOR ZIP+4 tax rate file
// Accepts the raw .txt file content, parses it, and upserts into tax_rates.
// File format (comma-separated, no header):
//   ZIP,PLUS4,CODE,STATE_RATE,LOCAL_RATE,COMBINED_RATE,EFFECTIVE_DATE,EXPIRATION_DATE
// e.g.: 98198,0000,1709,0.06500,0.03900,0.10400,20260701,20260930

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { content } = body as { content: string };
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "No file content received." }, { status: 400 });
    }

    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) {
      return NextResponse.json({ error: "File appears to be empty." }, { status: 400 });
    }

    // Parse all lines
    const parsed: {
      zip: string; plus4: string; location_code: string;
      state_rate: number; local_rate: number; combined_rate: number;
      effective_date: string | null; expiration_date: string | null;
    }[] = [];

    let skipped = 0;
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 6) { skipped++; continue; }

      const [zip, plus4, code, stateR, localR, combinedR, effDate, expDate] = parts;

      const combined = parseFloat(combinedR);
      if (!zip || zip.length !== 5 || isNaN(combined)) { skipped++; continue; }

      // Parse date YYYYMMDD → ISO
      function parseDate(d: string): string | null {
        const s = (d ?? "").trim();
        if (s.length !== 8) return null;
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      }

      parsed.push({
        zip: zip.trim(),
        plus4: (plus4 ?? "0000").trim(),
        location_code: (code ?? "").trim(),
        state_rate: parseFloat(stateR) || 0,
        local_rate: parseFloat(localR) || 0,
        combined_rate: combined,
        effective_date: parseDate(effDate),
        expiration_date: parseDate(expDate),
      });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid rows found. Check file format." }, { status: 400 });
    }

    const sb = await createClient();

    // Batch upsert in chunks of 1000 to avoid request size limits
    const CHUNK = 1000;
    let inserted = 0;
    for (let i = 0; i < parsed.length; i += CHUNK) {
      const chunk = parsed.slice(i, i + CHUNK);
      const { error } = await sb
        .from("tax_rates")
        .upsert(chunk, { onConflict: "zip,plus4" });
      if (error) {
        console.error("[Tax] upsert error at chunk", i, error.message);
        return NextResponse.json({
          error: `Upload failed at row ${i}: ${error.message}`,
          inserted,
        }, { status: 500 });
      }
      inserted += chunk.length;
    }

    // Record the upload timestamp and row count in store_settings
    await sb.from("store_settings").upsert([
      { key: "tax_rates_uploaded_at", value: new Date().toISOString() },
      { key: "tax_rates_row_count", value: String(inserted) },
    ], { onConflict: "key" });

    console.log(`[Tax] Uploaded ${inserted} rates (${skipped} skipped)`);
    return NextResponse.json({ ok: true, inserted, skipped });
  } catch (err) {
    console.error("[Tax] upload error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Upload failed. Check file format." }, { status: 500 });
  }
}

// GET — look up combined rate for a ZIP (uses most common rate for that ZIP)
export async function GET(request: NextRequest) {
  try {
    const zip = request.nextUrl.searchParams.get("zip")?.trim();
    const plus4 = request.nextUrl.searchParams.get("plus4")?.trim();

    if (!zip || zip.length !== 5) {
      return NextResponse.json({ error: "Provide a 5-digit zip." }, { status: 400 });
    }

    const sb = await createClient();

    if (plus4 && plus4.length === 4) {
      // Exact ZIP+4 lookup
      const { data } = await sb
        .from("tax_rates")
        .select("combined_rate,state_rate,local_rate,location_code")
        .eq("zip", zip)
        .eq("plus4", plus4)
        .single();
      if (data) return NextResponse.json({ zip, plus4, ...data });
    }

    // ZIP-only: return the most common rate (mode) for this ZIP
    const { data: rates } = await sb
      .from("tax_rates")
      .select("combined_rate,state_rate,local_rate,location_code")
      .eq("zip", zip);

    if (!rates || rates.length === 0) {
      return NextResponse.json({ error: "No rate found for this ZIP." }, { status: 404 });
    }

    // Find the most common combined_rate for this ZIP
    const freq: Record<string, number> = {};
    for (const r of rates) {
      const key = String(r.combined_rate);
      freq[key] = (freq[key] ?? 0) + 1;
    }
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    const match = rates.find((r) => String(r.combined_rate) === dominant)!;

    return NextResponse.json({ zip, rate_count: rates.length, ...match });
  } catch (err) {
    console.error("[Tax] lookup error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
