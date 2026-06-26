"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const { error: err } = await createClient().auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push(next); router.refresh();
  }

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="font-weight-bold mb-1" style={{ fontSize:"1.75rem" }}>Sign In</h1>
      <p className="text-muted mb-4 text-3">Access your orders and cart</p>
      <div className="p-4 rounded" style={{ border:"1px solid #e9ecef" }}>
        <form onSubmit={handle}>
          <div className="mb-3">
            <label className="form-label font-weight-semibold text-3">Email</label>
            <input type="email" className="form-control" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="mb-3">
            <label className="form-label font-weight-semibold text-3">Password</label>
            <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <div className="alert alert-danger py-2 mb-3 text-3">{error}</div>}
          <button className="btn btn-dark w-100 btn-modern" type="submit" disabled={loading} style={{ padding:"11px" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <hr />
        <p className="text-center mb-0 text-3">No account? <Link href={`/auth/register?next=${next}`} className="text-color-dark font-weight-semibold">Create one</Link></p>
      </div>
    </div>
  );
}
