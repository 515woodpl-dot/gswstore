import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // ── Subdomain routing ──────────────────────────────────────────────────────
  // alerts.goldenstonesupply.com → /alerts
  // admin.goldenstonesupply.com  → /admin
  const host = request.headers.get("host") || "";
  const sub = host.split(":")[0].split(".")[0];
  const path = request.nextUrl.pathname;

  if (sub === "alerts" && !path.startsWith("/alerts") && !path.startsWith("/auth") && !path.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = `/alerts${path === "/" ? "" : path}`;
    return NextResponse.rewrite(url);
  }
  if (sub === "admin" && !path.startsWith("/admin") && !path.startsWith("/auth") && !path.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = `/admin${path === "/" ? "" : path}`;
    return NextResponse.rewrite(url);
  }

  // ── Session refresh + route guards ─────────────────────────────────────────
  let res = NextResponse.next({ request });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(set) {
          set.forEach(({ name, value }) => request.cookies.set(name, value));
          res = NextResponse.next({ request });
          set.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await sb.auth.getUser();

  const needsAuth =
    path.startsWith("/account") || path.startsWith("/checkout") ||
    path.startsWith("/admin") || path.startsWith("/alerts");

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"],
};
