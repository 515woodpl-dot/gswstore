import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/account");

  return (
    <div style={{ padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <h1 className="mb-4" style={{ fontSize: "1.75rem", fontWeight: 700 }}>My Account</h1>

        <div className="row g-3 mb-4">
          <div className="col-sm-6">
            <div className="p-4 rounded h-100" style={{ border: "1px solid #e9ecef" }}>
              <i className="fas fa-user mb-2" style={{ color: "#0d6efd" }} />
              <h5 className="mt-1 mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Profile</h5>
              <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>{user.email}</p>
              <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                {user.user_metadata?.full_name || "Name not set"}
              </p>
            </div>
          </div>

          <div className="col-sm-6">
            <Link href="/account/orders" className="text-decoration-none">
              <div className="p-4 rounded h-100 d-flex flex-column justify-content-between" style={{ border: "1px solid #e9ecef", transition: "border-color 0.15s" }}>
                <div>
                  <i className="fas fa-box mb-2" style={{ color: "#0d6efd" }} />
                  <h5 className="mt-1 mb-1" style={{ fontSize: "1rem", fontWeight: 600, color: "#1a1a1a" }}>My Orders</h5>
                  <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>View your order history and pickup status</p>
                </div>
                <span className="text-dark" style={{ fontSize: "0.8rem", marginTop: 12 }}>View orders →</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="p-3 rounded" style={{ background: "#f8f9fa", fontSize: "0.85rem" }}>
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-muted">Member since {new Date(user.created_at).toLocaleDateString()}</span>
            <Link href="/" className="btn btn-sm btn-outline-danger">Sign Out</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
