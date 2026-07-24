import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // ── Subdomain routing ──────────────────────────────────────────────────────
  // alerts.goldenstonesupply.com → /alerts
  // admin.goldenstonesupply.com  → /admin
  const host = request.headers.get("host") || "";
  const sub = host.split(":")[0].split(".")[0];
  const path = request.nextUrl.pathname;

  // Never rewrite PWA assets or shared staff routes — they must resolve
  // at the root path on every subdomain.
  const isSharedRoute =
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path === "/offline" ||
    path.startsWith("/icon-") ||
    path === "/apple-touch-icon.png" ||
    path === "/favicon.png" ||
    path.startsWith("/staff") ||
    path.startsWith("/brand/");

  if (isSharedRoute) return NextResponse.next();

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
    path.startsWith("/admin") || path.startsWith("/alerts") ||
    path.startsWith("/staff");

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json|webmanifest)$).*)",
  ],
};
