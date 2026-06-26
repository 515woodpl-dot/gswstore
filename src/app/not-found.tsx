import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-5 text-center" style={{ minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ fontSize: "4rem", fontWeight: 800, color: "#dee2e6" }}>404</h1>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Page not found</h2>
      <p className="text-muted mb-4">The page you are looking for does not exist or has moved.</p>
      <div className="d-flex gap-2">
        <Link href="/" className="btn btn-dark">Go Home</Link>
        <Link href="/shop" className="btn btn-outline-dark">Browse Products</Link>
      </div>
    </div>
  );
}
