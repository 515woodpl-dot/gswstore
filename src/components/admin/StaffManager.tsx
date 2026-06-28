"use client";

import { useEffect, useState } from "react";

interface Staff {
  user_id: string;
  email: string;
  role: "owner" | "staff";
  created_at: string;
}

export default function StaffManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/staff");
    const json = await res.json();
    if (res.ok) setStaff(json.staff);
    else setError(json.error || "Failed to load staff");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!email.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const json = await res.json();
    if (res.ok) { setNotice(`${email} is now ${role}.`); setEmail(""); await load(); }
    else setError(json.error || "Failed to add staff");
    setBusy(false);
  }

  async function remove(user_id: string, who: string) {
    if (!confirm(`Remove ${who}'s admin access?`)) return;
    setError(""); setNotice("");
    const res = await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id }),
    });
    const json = await res.json();
    if (res.ok) { setNotice(`${who} removed.`); await load(); }
    else setError(json.error || "Failed to remove");
  }

  return (
    <div className="space-y-6">
      {/* Add staff */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-950">Grant access</h2>
        <p className="mb-4 text-sm text-slate-600">
          The person must already have signed up at the store. Enter their account email.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-navy"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as "staff" | "owner")}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          <button onClick={add} disabled={busy}
            className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          <strong>Staff</strong> can manage inventory and orders. <strong>Owners</strong> can also manage staff.
        </p>
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      </div>

      {/* Current staff */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          Current Staff
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No staff yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.email}</p>
                  <p className="text-xs text-slate-500">Added {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${s.role === "owner" ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-700"}`}>
                    {s.role}
                  </span>
                  <button onClick={() => remove(s.user_id, s.email)}
                    className="text-sm font-semibold text-rose-600 hover:underline">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
