"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { receiptSchema } from "@/lib/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Server Actions are reachable by direct POST, so each one re-authenticates.
 * RLS is the second line of defence: a volunteer can only touch their own rows.
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
  });
}

export async function createReceipt(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
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

  const { error } = await supabase
    .from("receipts")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

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
