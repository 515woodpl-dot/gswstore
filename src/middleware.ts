import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVITY_COOKIE, authCookieOptions, createActivityToken, safeNextPath, verifyActivityToken } from "@/lib/auth-security";

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function signOutResponse(request: NextRequest, response: NextResponse, reason: "timeout" | "security") {
  response.cookies.delete(ACTIVITY_COOKIE);
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return copyCookies(response, NextResponse.json({ error: reason === "timeout" ? "Your session expired due to inactivity." : "Your session needs a password reset." }, { status: 401 }));
  }
  const url = request.nextUrl.clone();
  url.pathname = reason === "security" ? "/auth/forgot-password" : "/auth/login";
  url.search = "";
  url.searchParams.set(reason, "1");
  url.searchParams.set("next", safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
  return copyCookies(response, NextResponse.redirect(url));
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const sub = host.split(":")[0].split(".")[0];
  const path = request.nextUrl.pathname;

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

  let rewriteUrl: URL | undefined;
  let routedPath = path;
  if (sub === "alerts" && !path.startsWith("/alerts") && !path.startsWith("/auth") && !path.startsWith("/api/") && !path.startsWith("/_next")) {
    rewriteUrl = request.nextUrl.clone();
    routedPath = `/alerts${path === "/" ? "" : path}`;
    rewriteUrl.pathname = routedPath;
  }
  if (sub === "admin" && !path.startsWith("/admin") && !path.startsWith("/auth") && !path.startsWith("/api/") && !path.startsWith("/_next")) {
    rewriteUrl = request.nextUrl.clone();
    routedPath = `/admin${path === "/" ? "" : path}`;
    rewriteUrl.pathname = routedPath;
  }

  const newResponse = () => rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next({ request });
  let response = newResponse();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = newResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const activity = await verifyActivityToken(request.cookies.get(ACTIVITY_COOKIE)?.value, user.id);
    if (activity.inconsistent) {
      if (user.email) {
        await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${request.nextUrl.origin}/api/auth/callback?next=/auth/update-password&type=recovery`,
        });
      }
      await supabase.auth.signOut();
      return signOutResponse(request, response, "security");
    }
    if (activity.expired) {
      await supabase.auth.signOut();
      return signOutResponse(request, response, "timeout");
    }

    response.cookies.set(ACTIVITY_COOKIE, await createActivityToken(user.id), {
      ...authCookieOptions,
      httpOnly: true,
    });
  } else {
    response.cookies.delete(ACTIVITY_COOKIE);
  }

  const needsAuth =
    routedPath.startsWith("/account") || routedPath.startsWith("/checkout") ||
    routedPath.startsWith("/admin") || routedPath.startsWith("/alerts") ||
    routedPath.startsWith("/staff");

  if (needsAuth && !user) {
    if (path.startsWith("/api/")) return copyCookies(response, NextResponse.json({ error: "Authentication required." }, { status: 401 }));
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", safeNextPath(path));
    return copyCookies(response, NextResponse.redirect(url));
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json|webmanifest)$).*)",
  ],
};
