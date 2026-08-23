"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { receiptSchema } from "@/lib/schemas";
import type { PaymentMethod, Receipt } from "@/lib/types";
import { displayName } from "@/lib/receipt-utils";
import { getVolunteerNames } from "@/lib/volunteer-names";

export type ActionResult =
  | { ok: true }
  /** A receipt for the same number and date already exists. */
  | { ok: false; duplicate: { amount: number; date: string; who: string | null } }
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
  return receiptSchema.safeParse({
    donor_name: formData.get("donor_name"),
    amount: formData.get("amount"),
    phone_number: formData.get("phone_number"),
    payment_method: formData.get("payment_method"),
    collection_date: formData.get("collection_date"),
    payment_status: formData.get("payment_status") ?? undefined,
    due_on: formData.get("due_on") ?? undefined,
  });
}

export async function createReceipt(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Advisory duplicate check: the same donor may legitimately give twice, so
  // this warns once and proceeds if the volunteer confirms.
  if (formData.get("confirm_duplicate") !== "1") {
    const { data: existing } = await supabase
      .from("receipts")
      .select("amount, collection_date, created_by_email")
      .eq("phone_number", parsed.data.phone_number)
      .eq("collection_date", parsed.data.collection_date)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        duplicate: {
          amount: Number(existing.amount),
          date: existing.collection_date,
          // Resolved here: the dialog has an email and no name map.
          who: displayName(
            existing.created_by_email,
            await getVolunteerNames(),
          ),
        },
      };
    }
  }

  const { error } = await supabase
    .from("receipts")
    .insert({ ...parsed.data, user_id: user.id });

  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

export async function updateReceipt(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Optimistic locking: the form carries the updated_at it was opened with, so
  // a second volunteer saving the same receipt is told rather than clobbered.
  const expected = formData.get("expected_updated_at");
  let query = supabase.from("receipts").update(parsed.data).eq("id", id);
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

/**
 * Marks a pledge as received: the money arrived, so the row joins every
 * collected figure and leaves the reminder list. The due date is cleared to
 * satisfy the constraint that only unpaid rows carry one.
 */
export async function markReceiptPaid(
  id: string,
  paymentMethod: PaymentMethod,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("receipts")
    .update({
      payment_status: "Paid",
      due_on: null,
      payment_method: paymentMethod,
    })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "not-found" };

  refresh();
  return { ok: true };
}

export async function deleteReceipt(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

/** Recent donors, for the create form's autocomplete. */
export async function searchDonors(term: string) {
  const { supabase } = await requireUser();
  const clean = term.trim();
  if (clean.length < 2) return [];

  const { data } = await supabase
    .from("donor_directory")
    .select("*")
    .ilike("donor_name", `%${clean}%`)
    .order("last_collection", { ascending: false })
    .limit(6);

  return (data ?? []) as {
    donor_name: string;
    phone_number: string;
    lifetime_total: number;
    receipt_count: number;
    last_collection: string;
  }[];
}

/** One page of receipts, newest first. */
export async function fetchReceipts(offset: number, limit = 50) {
  const { supabase } = await requireUser();

  const { data, count } = await supabase
    .from("receipts")
    .select("*", { count: "exact" })
    .order("collection_date", { ascending: false })
    .order("receipt_number", { ascending: false })
    .range(offset, offset + limit - 1);

  return { rows: (data ?? []) as Receipt[], total: count ?? 0 };
}
