"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { donationSchema } from "@/lib/schemas";

export type DonationResult =
  | { ok: true }
  /** The row changed underneath us; the caller must reload before retrying. */
  | { ok: false; conflict: true }
  | { ok: false; error: string };

/**
 * Server Actions are reachable by direct POST, so each one re-authenticates.
 * RLS is the second line of defence.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function fieldsFrom(formData: FormData) {
  return donationSchema.safeParse({
    donor_name: formData.get("donor_name"),
    phone_number: formData.get("phone_number"),
    item: formData.get("item"),
    value: formData.get("value") ?? undefined,
    donation_date: formData.get("donation_date"),
  });
}

export async function createDonation(
  formData: FormData,
): Promise<DonationResult> {
  const { supabase, user } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("donations")
    .insert({ ...parsed.data, user_id: user.id });

  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

export async function updateDonation(
  id: string,
  formData: FormData,
): Promise<DonationResult> {
  const { supabase } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Optimistic locking, as receipts/expenses do it: the form carries the
  // updated_at it was opened with, so a second volunteer saving is told
  // rather than clobbered.
  const expected = formData.get("expected_updated_at");
  let query = supabase.from("donations").update(parsed.data).eq("id", id);
  if (typeof expected === "string" && expected) {
    query = query.eq("updated_at", expected);
  }

  const { data, error } = await query.select("id");
  if (error) return { ok: false, error: error.message };

  // Zero rows means the guard matched nothing: someone edited it first.
  if (!data || data.length === 0) return { ok: false, conflict: true };

  refresh();
  return { ok: true };
}

export async function deleteDonation(id: string): Promise<DonationResult> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("donations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}
