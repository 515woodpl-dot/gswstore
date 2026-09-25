// Renders the "Key attributes" block (label over value) populated from the
// inventory item's `attributes` JSON. Matches the divided-grid reference design.
export default function KeyAttributes({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes || {}).filter(
    ([k, v]) => k.trim() !== "" && String(v).trim() !== ""
  );
  if (entries.length === 0) return null;

  return (
    <section className="mt-6 border-t border-slate-300 pt-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">At a glance</p>
      <h2 className="font-display mb-4 mt-1 text-2xl font-black uppercase tracking-[-0.04em] text-brand-navy">Key attributes</h2>
      <div className="border border-slate-300 bg-white px-4 sm:px-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {entries.map(([label, value]) => {
            const isLong = label.toLowerCase() === "application" || String(value).length > 80;
            const values = isLong ? [...new Set(String(value).split(",").map((part) => part.trim()).filter(Boolean))] : [];
            return (
              <div key={label} className={`border-b border-slate-200 py-3 last:border-b-0 ${isLong ? "sm:col-span-2" : "sm:odd:pr-5 sm:even:border-l sm:even:pl-5"}`}>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                {isLong ? (
                  <dd className="mt-2 flex flex-wrap gap-1.5">{values.map((entry) => <span key={entry.toLowerCase()} className="rounded-sm bg-slate-100 px-2 py-1 text-[10px] font-bold text-brand-navy">{entry}</span>)}</dd>
                ) : (
                  <dd className="mt-1 text-sm font-black text-brand-navy">{value}</dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
