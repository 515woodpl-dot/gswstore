// Renders the "Key attributes" block (label over value) populated from the
// inventory item's `attributes` JSON. Matches the divided-grid reference design.
export default function KeyAttributes({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes || {}).filter(
    ([k, v]) => k.trim() !== "" && String(v).trim() !== ""
  );
  if (entries.length === 0) return null;

  return (
    <section className="mt-10 border-t border-slate-300 pt-10">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">At a glance</p>
      <h2 className="font-display mb-6 mt-2 text-3xl font-black uppercase tracking-[-0.04em] text-brand-navy">Key attributes</h2>
      <div className="border border-slate-300 bg-white p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="border-slate-200 pl-0 sm:[&:not(:nth-child(2n+1))]:border-l sm:[&:not(:nth-child(2n+1))]:pl-6 lg:[&:not(:nth-child(3n+1))]:border-l lg:[&:not(:nth-child(3n+1))]:pl-6"
            >
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="font-display mt-1 text-lg font-black uppercase text-brand-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
