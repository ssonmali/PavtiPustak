import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

/**
 * Next.js 16 renamed Middleware to Proxy. This refreshes the Supabase auth
 * cookies on every request and keeps unauthenticated users off /dashboard.
 * It is an optimistic check only — each Server Action re-verifies the user.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /*
   * getClaims(), not getUser() — and never getSession().
   *
   * getSession() only decodes the cookie and is forgeable, so it cannot gate.
   * getUser() POSTs the JWT and waits: correct, but a round trip on EVERY
   * matched request. getClaims() verifies the signature locally with WebCrypto
   * — as trustworthy for identity, usually with no round trip — and still
   * refreshes a near-expiry session, which is what this proxy exists for.
   *
   * It needs the project on ASYMMETRIC signing keys; on the legacy symmetric
   * secret auth-js falls back to a network call itself, so it is safe either
   * way and simply buys nothing there.
   *
   * What it does NOT do is notice a revoked account mid-token. Every Server
   * Action catches that instead — one check per write rather than per render.
   * See lib/auth.ts.
   */
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const { pathname } = request.nextUrl;

  /*
   * "/" is handled here rather than only in app/page.tsx, which redirects to
   * /dashboard unconditionally. A logged-out visitor to "/" would then pay
   * "/" -> /dashboard -> /login: two redirects before the first byte of the
   * page they were always going to get. Measured at 765ms on throttled
   * mobile, the single largest entry in Lighthouse's opportunities. The proxy
   * already knows the auth state, so it can send them straight there.
   */
  if (!user && (pathname === "/" || pathname.startsWith("/dashboard"))) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets. Each match costs a JWT verification
    // (see getClaims above — local where the project allows it, a round trip
    // otherwise), so the service worker and the manifest are excluded too:
    // they are fetched on every load and carry nothing to gate.
    //
    // api/health is excluded for a second reason: it exists to answer "did a
    // request reach the server", and putting an auth check in front of it
    // would make that answer depend on Supabase being quick. A slow database
    // would then time the probe out and report a working connection as
    // offline, which is the bug the probe was added to fix.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/health|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest|txt)$).*)",
  ],
};
