import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in volunteer, for rendering.
 *
 * getClaims(), not getUser(): the latter posts the JWT to Supabase and waits,
 * one round trip on every render — and getMyName() awaits this before starting
 * its own query, so the two were serial. getClaims verifies the signature
 * locally with WebCrypto, which is no weaker a check of identity. It needs the
 * project on asymmetric keys (ES256 here); on a legacy symmetric secret auth-js
 * falls back to a round trip on its own, so this is safe either way.
 *
 * WHAT IS GIVEN UP: a signature stays valid until the token expires, so a
 * disabled account can still READ for up to an hour. It cannot WRITE — every
 * Server Action calls getUser() itself (requireUser in app/actions/*.ts) with
 * RLS behind it — and the refresh then fails, so it self-heals. If this ever
 * guards something that must revoke instantly, put getUser() back.
 *
 * cache() scopes it to one request, so layout, page and getMyName share one
 * verification.
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
