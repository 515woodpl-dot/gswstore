export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-2xl font-black text-slate-950">You're offline</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Check your connection and try again. Your last-loaded pages are available below.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <a href="/alerts" className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white">
          → Alerts
        </a>
        <a href="/admin/inventory" className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
          → Admin
        </a>
      </div>
    </div>
  );
}
