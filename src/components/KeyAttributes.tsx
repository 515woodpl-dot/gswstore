// Renders the "Key attributes" block (label over value) populated from the
// inventory item's `attributes` JSON. Matches the divided-grid reference design.
export default function KeyAttributes({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes || {}).filter(
    ([k, v]) => k.trim() !== "" && String(v).trim() !== ""
  );
  if (entries.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-black tracking-tight text-slate-950">Key attributes</h2>
      <div className="rounded-2xl bg-slate-50 p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="border-slate-200 pl-0 sm:[&:not(:nth-child(2n+1))]:border-l sm:[&:not(:nth-child(2n+1))]:pl-6 lg:[&:not(:nth-child(3n+1))]:border-l lg:[&:not(:nth-child(3n+1))]:pl-6"
            >
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
