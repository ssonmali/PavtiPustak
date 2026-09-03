import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in volunteer, for rendering.
 *
 * This used to be `getUser()`, which is not a local cookie read: it posts the
 * JWT to Supabase's auth endpoint and waits for an answer. That is one network
 * round trip on the critical path of every dashboard render — and it is worse
 * than it looks, because getMyName() awaits this before it can even start its
 * own query, so the two are serial. Every router.refresh() paid it again, and
 * the realtime fallback fires those on a timer.
 *
 * getClaims() answers the same question by verifying the token's signature
 * locally with WebCrypto against the project's cached public keys. That is not
 * a weaker check of *identity* — a signature either verifies or it does not,
 * and a forged cookie fails both ways. The project is on asymmetric ES256 keys
 * (confirmed at /auth/v1/.well-known/jwks.json), which is what makes the local
 * path available; on the legacy symmetric secret auth-js silently falls back to
 * a round trip, so this is safe either way and simply buys nothing there.
 *
 * WHAT IS GIVEN UP, precisely: a signature stays valid until the token
 * expires, so a volunteer whose account is deleted or disabled can still READ
 * the ledger for up to the token's lifetime. They cannot WRITE anything —
 * every Server Action calls supabase.auth.getUser() itself (see requireUser in
 * app/actions/*.ts), which is a real check against the auth server, and RLS is
 * behind that. Their refresh will also fail, so it self-heals within the hour
 * rather than needing anything done. For a mandal's receipt book that is the
 * right side of the trade; if this ever guards something that must revoke
 * instantly, put a getUser() back here and accept the round trip.
 *
 * Returns only what render paths use. The full User object is not available
 * from claims and nothing here wanted it.
 *
 * React's `cache()` scopes this to one request, so the layout, the page and
 * getMyName() share one verification rather than three.
 */
export const getViewer = cache(async (): Promise<{
  id: string;
  email: string | null;
} | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});
