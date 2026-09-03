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
   * All three answer "who is this", at very different prices. getSession()
   * only decodes the cookie and is therefore forgeable, so it is not an option
   * for a gate. getUser() POSTs the JWT to Supabase's auth endpoint and waits
   * for an answer: correct, but a network round trip on EVERY matched request,
   * which on a phone is the slowest thing in a tab switch.
   *
   * getClaims() verifies the token's signature locally with WebCrypto against
   * the project's cached public keys, so it is exactly as trustworthy as
   * getUser() for identity while usually costing no round trip at all. It
   * still refreshes the session first if the token is close to expiry, which
   * is what keeps the cookie-refresh behaviour this proxy exists for.
   *
   * The caveat worth knowing: local verification needs the project to be on
   * ASYMMETRIC JWT signing keys (Dashboard > Auth > Signing Keys). On the
   * legacy symmetric secret this falls back to a network call by itself, so it
   * is safe either way — it simply buys nothing until that migration is done.
   *
   * What this does NOT do is notice a volunteer whose account was deleted or
   * disabled mid-token: a valid signature stays valid until it expires. The
   * layout used to cover that with a getUser() on every render, and no longer
   * does — that round trip was the slowest thing in a tab switch. What catches
   * a revoked account now is every Server Action, which is where it costs one
   * check per write instead of one per render. See lib/auth.ts.
   */
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
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
