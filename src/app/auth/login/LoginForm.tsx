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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="container py-5" style={{ maxWidth: 440 }}>
      <div className="text-center mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Sign In</h1>
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>Access your orders and cart</p>
      </div>
      <div className="p-4 rounded" style={{ border: "1px solid #e9ecef" }}>
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: "0.85rem" }}>{error}</div>}
          <button className="btn btn-dark w-100" type="submit" disabled={loading} style={{ padding: "11px" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div style={{ height: 1, background: "#e9ecef", margin: "20px 0" }} />
        <p className="text-center mb-0" style={{ fontSize: "0.875rem" }}>
          No account?{" "}
          <Link href={`/auth/register${next !== "/" ? `?next=${next}` : ""}`} className="text-dark fw-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
