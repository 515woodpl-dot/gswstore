"use client";

type HoneypotValues = {
  website: string;
  faxNumber: string;
  contactPreference: string;
};

export default function AuthHoneypots({ values, onChange }: { values: HoneypotValues; onChange: (patch: Partial<HoneypotValues>) => void }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden" data-auth-honeypot>
      <label>
        Website
        <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => onChange({ website: event.target.value })} />
      </label>
      <label>
        Fax number
        <input tabIndex={-1} autoComplete="off" value={values.faxNumber} onChange={(event) => onChange({ faxNumber: event.target.value })} />
      </label>
      <label>
        Preferred contact time
        <input tabIndex={-1} autoComplete="off" value={values.contactPreference} onChange={(event) => onChange({ contactPreference: event.target.value })} />
      </label>
    </div>
  );
}
