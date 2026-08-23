"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveNameResult = { ok: true } | { ok: false; error: string };

/**
 * Sets — or, with a blank value, clears — the signed-in volunteer's name.
 *
 * The email is taken from the session, never from the form, so the RLS policy
 * and the app agree on whose row is being written.
 */
export async function saveMyName(formData: FormData): Promise<SaveNameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Unauthorized" };

  const email = user.email.toLowerCase();
  const raw = String(formData.get("display_name") ?? "").trim();

  if (raw.length === 0) {
    const { error } = await supabase
      .from("volunteer_names")
      .delete()
      .eq("email", email);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  }

  // Matches the CHECK constraint, so a too-long name is rejected here with a
  // readable message instead of a Postgres error.
  if (raw.length > 60) return { ok: false, error: "too-long" };

  const { error } = await supabase
    .from("volunteer_names")
    .upsert({ email, display_name: raw }, { onConflict: "email" });

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
