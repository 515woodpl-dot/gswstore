"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
      },
    });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 440 }}>
        <i className="fas fa-envelope-open-text mb-3" style={{ fontSize: "3rem", color: "#0d6efd" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Check your email</h2>
        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
        <Link href="/auth/login" className="btn btn-outline-dark btn-sm mt-2">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 440 }}>
      <div className="text-center mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Create Account</h1>
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>Save your cart and track orders</p>
      </div>
      <div className="p-4 rounded" style={{ border: "1px solid #e9ecef" }}>
        <form onSubmit={handleRegister}>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Full Name</label>
            <input type="text" className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="form-text">At least 8 characters</div>
          </div>
          {error && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: "0.85rem" }}>{error}</div>}
          <button className="btn btn-dark w-100" type="submit" disabled={loading} style={{ padding: "11px" }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <div style={{ height: 1, background: "#e9ecef", margin: "20px 0" }} />
        <p className="text-center mb-0" style={{ fontSize: "0.875rem" }}>
          Already have an account? <Link href="/auth/login" className="text-dark fw-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
