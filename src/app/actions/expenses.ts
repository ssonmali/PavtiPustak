"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/schemas";

export type ExpenseResult =
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
  return expenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    payment_method: formData.get("payment_method"),
    spent_on: formData.get("spent_on"),
    note: formData.get("note") ?? undefined,
  });
}

export async function createExpense(
  formData: FormData,
): Promise<ExpenseResult> {
  const { supabase, user } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("expenses")
    .insert({ ...parsed.data, user_id: user.id });

  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

export async function updateExpense(
  id: string,
  formData: FormData,
): Promise<ExpenseResult> {
  const { supabase } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Optimistic locking, as receipts do it: the form carries the updated_at it
  // was opened with, so a second volunteer saving is told rather than clobbered.
  const expected = formData.get("expected_updated_at");
  let query = supabase.from("expenses").update(parsed.data).eq("id", id);
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

export async function deleteExpense(id: string): Promise<ExpenseResult> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}
