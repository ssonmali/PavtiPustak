import "server-only";

import { cache } from "react";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NameMap } from "@/lib/types";

/**
 * Every volunteer's display name, keyed by lower-cased email.
 *
 * One query per page that renders attribution, rather than a join on each row:
 * a mandal has a handful of volunteers, so the whole table is smaller than any
 * single page of receipts.
 *
 * Deliberately not a Server Action — these are reads used during render, and
 * marking them `"use server"` would publish them as POST endpoints for nothing.
 */
export const getVolunteerNames = cache(async (): Promise<NameMap> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteer_names")
    .select("email, display_name");

  const map: NameMap = {};
  for (const row of data ?? []) {
    map[row.email.toLowerCase()] = row.display_name;
  }
  return map;
});

/**
 * The signed-in volunteer's own name, or null if they have not set one.
 *
 * Cached per request: the header renders it and so does any page that needs it,
 * and without this each caller repeated both the auth call and the query.
 */
export const getMyName = cache(async () => {
  const user = await getUser();
  if (!user?.email) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteer_names")
    .select("display_name")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  return data?.display_name ?? null;
});
