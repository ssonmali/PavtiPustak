import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in volunteer, fetched once per request.
 *
 * `getUser()` is not a local cookie read — it posts the JWT to Supabase's auth
 * endpoint to have it validated. Rendering one dashboard page called it four
 * times over (the layout, the page, and `getMyName()` from each), so a cold
 * visit paid four round-trips to answer the same question.
 *
 * React's `cache()` is scoped to a single request, so this dedupes without ever
 * holding a user across requests — the validation still happens on every one.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
