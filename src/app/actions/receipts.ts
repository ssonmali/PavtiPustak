"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { receiptSchema } from "@/lib/schemas";
import type { PaymentMethod, Receipt } from "@/lib/types";
import { displayName } from "@/lib/receipt-utils";
import { getVolunteerNames } from "@/lib/volunteer-names";
import { planRestore } from "@/lib/restore-receipt";
import {
  applyReceiptQuery,
  clampPage,
  type ReceiptQuery,
} from "@/app/dashboard/receipts-query";

export type ActionResult =
  | { ok: true }
  /** A receipt for the same number and date already exists. */
  | { ok: false; duplicate: { amount: number; date: string; who: string | null } }
  /** The row changed underneath us; the caller must reload before retrying. */
  | { ok: false; conflict: true }
  /**
   * A restore cannot go ahead because another receipt now holds the number.
   * Carries who holds it, so the volunteer is told which one rather than just
   * being refused.
   */
  | {
      ok: false;
      numberTaken: { number: number; who: string; date: string };
    }
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
    donor_name_mr: formData.get("donor_name_mr") ?? undefined,
    amount: formData.get("amount"),
    paid_amount: formData.get("paid_amount") ?? undefined,
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

  /*
   * No refresh() here, deliberately. It re-renders the route INSIDE this
   * response (see next/dist/docs 01-app/02-guides/server-actions.md), so the
   * dialog's await did not resolve until the dashboard's eight aggregate
   * queries had re-run — the row was already written, but Save kept spinning
   * for the render. The caller refreshes after it closes instead, and the
   * realtime subscription refreshes every other device anyway.
   */
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

  // No refresh() — see the note in createReceipt.
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
      // Cleared along with the due date. The whole amount is now received, so
      // an instalment figure would be a second, contradictory record of the
      // same money — and receipts_paid_amount_range rejects the pairing
      // outright, so leaving it set would make this fail on any part-paid row.
      paid_amount: null,
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

/**
 * Puts a deleted receipt back, from the snapshot the audit trigger saved.
 *
 * A delete is the one action in this app with no undo beyond the three-second
 * toast, and the row it removes is a record a donor holds a paper copy of.
 * receipt_audit already stores the whole row in `before` (02-audit-and-shared-
 * editing.sql), and receipt_id is deliberately not a foreign key so the entry
 * survives the deletion — so the data to undo one has always been there, it
 * just had no way back into the ledger short of hand-written SQL.
 *
 * The row is restored with its ORIGINAL identity: same id, same number, same
 * author, same dates. A receipt that came back renumbered would no longer
 * match the slip in the donor's hand, which would defeat the point.
 *
 * `pin_receipt_identity` (16-write-integrity.sql) pins those columns on UPDATE
 * only, so this INSERT is allowed to set them.
 */
export async function restoreReceipt(auditId: number): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: audit, error: auditError } = await supabase
    .from("receipt_audit")
    .select("action, before")
    .eq("id", auditId)
    .maybeSingle();

  if (auditError) return { ok: false, error: auditError.message };

  // Read the snapshot first so a malformed entry is reported as such, then ask
  // whether the row is already back — a volunteer double-tapping should hear
  // "already restored", not a constraint violation.
  const probe = planRestore(audit, false);
  if (!probe.ok) return { ok: false, error: probe.reason };

  const { data: existing } = await supabase
    .from("receipts")
    .select("id")
    .eq("id", probe.fields.id)
    .maybeSingle();

  const plan = planRestore(audit, Boolean(existing));
  if (!plan.ok) return { ok: false, error: plan.reason };

  /*
   * The number, checked before the insert rather than left to the unique index.
   * Another receipt can have taken it since — by being renumbered by hand, which
   * is exactly what happened to #101 — and a raw constraint error would tell the
   * volunteer nothing about which receipt is in the way.
   */
  const { data: clash } = await supabase
    .from("receipts")
    .select("receipt_number, donor_name, collection_date")
    .eq("receipt_number", plan.fields.receipt_number)
    .maybeSingle();

  if (clash) {
    return {
      ok: false,
      numberTaken: {
        number: clash.receipt_number,
        who: clash.donor_name,
        date: clash.collection_date,
      },
    };
  }

  const { error } = await supabase.from("receipts").insert(plan.fields);
  if (error) return { ok: false, error: error.message };

  // No refresh() — see the note in createReceipt.
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
    donor_name_mr: string | null;
    lifetime_total: number;
    receipt_count: number;
    last_collection: string;
  }[];
}

/**
 * One page of receipts, under the same sort and filters as the first page.
 *
 * The query has to come from the caller. This used to be hardcoded to
 * newest-first and unfiltered, so "show more" appended rows from a different
 * result than the one on screen — which is what let an ascending sort start at
 * #47 and then acquire #1 at the top once more rows arrived.
 *
 * Bounds come from clampPage: a server action is a public POST endpoint, and
 * offset and limit went into .range() unvalidated.
 */
export async function fetchReceipts(
  query: ReceiptQuery,
  rawOffset: number,
  rawLimit?: number,
) {
  const { supabase } = await requireUser();
  const { offset, limit } = clampPage(rawOffset, rawLimit);

  const { data, count } = await applyReceiptQuery(
    supabase.from("receipts").select("*", { count: "exact" }),
    query,
  ).range(offset, offset + limit - 1);

  return { rows: (data ?? []) as Receipt[], total: count ?? 0 };
}
