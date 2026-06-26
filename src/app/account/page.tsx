import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/account");

  return (
    <div className="container py-4" style={{ maxWidth:720 }}>
      <h1 className="font-weight-bold mb-4">My Account</h1>
      <div className="row g-3">
        <div className="col-sm-6">
          <div className="p-4 rounded h-100" style={{ border:"1px solid #e9ecef" }}>
            <i className="fas fa-user text-primary mb-2" />
            <h5 className="mt-1 mb-1">Profile</h5>
            <p className="text-muted text-3 mb-1">{user.email}</p>
            <p className="text-muted text-3 mb-0">{user.user_metadata?.full_name || "Name not set"}</p>
          </div>
        </div>
        <div className="col-sm-6">
          <Link href="/account/orders" className="text-decoration-none">
            <div className="p-4 rounded h-100 d-flex flex-column justify-content-between" style={{ border:"1px solid #e9ecef" }}>
              <div>
                <i className="fas fa-box text-primary mb-2" />
                <h5 className="mt-1 mb-1 text-color-dark">My Orders</h5>
                <p className="text-muted text-3 mb-0">View your order history and pickup status</p>
              </div>
              <span className="text-color-dark text-3 mt-3">View orders &rarr;</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
