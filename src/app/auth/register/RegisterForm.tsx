"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const params = useSearchParams();
  const next = params.get("next") || "/";

  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const { error: err } = await createClient().auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${next}` }
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setDone(true);
  }

  if (done) return (
    <div className="container py-5 text-center" style={{ maxWidth:480 }}>
      <i className="fas fa-envelope-open-text mb-3" style={{ fontSize:"3rem", color:"#0d6efd" }} />
      <h2 className="font-weight-bold">Check your email</h2>
      <p className="text-muted text-3">We sent a confirmation link to <strong>{email}</strong>.</p>
      <Link href="/auth/login" className="btn btn-outline-dark btn-sm mt-2">Back to sign in</Link>
    </div>
  );

  return (
    <div className="container py-5" style={{ maxWidth:480 }}>
      <h1 className="font-weight-bold mb-1" style={{ fontSize:"1.75rem" }}>Create Account</h1>
      <p className="text-muted mb-4 text-3">Save your cart and track orders</p>
      <div className="p-4 rounded" style={{ border:"1px solid #e9ecef" }}>
        <form onSubmit={handle}>
          <div className="mb-3">
            <label className="form-label font-weight-semibold text-3">Full Name</label>
            <input type="text" className="form-control" value={name} onChange={e=>setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="mb-3">
            <label className="form-label font-weight-semibold text-3">Email</label>
            <input type="email" className="form-control" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="mb-3">
            <label className="form-label font-weight-semibold text-3">Password</label>
            <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} />
            <div className="form-text">At least 8 characters</div>
          </div>
          {error && <div className="alert alert-danger py-2 mb-3 text-3">{error}</div>}
          <button className="btn btn-dark w-100 btn-modern" type="submit" disabled={loading} style={{ padding:"11px" }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <hr />
        <p className="text-center mb-0 text-3">Already have an account? <Link href="/auth/login" className="text-color-dark font-weight-semibold">Sign in</Link></p>
      </div>
    </div>
  );
}
