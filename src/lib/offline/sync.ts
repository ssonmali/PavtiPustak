"use client";

import {
  createReceipt,
  deleteReceipt,
  updateReceipt,
} from "@/app/actions/receipts";
import { dequeue, enqueue, readOutbox, setMeta, type OutboxEntry } from "./db";

const MAX_ATTEMPTS = 5;

export type FlushResult = {
  synced: number;
  conflicts: number;
  failed: number;
};

function toFormData(entry: OutboxEntry) {
  const formData = new FormData();
  if (!entry.fields) return formData;

  formData.set("donor_name", entry.fields.donor_name);
  // Conditional for the same reason as the status fields below: an entry queued
  // by a build from before this column existed simply has nothing to send.
  if (entry.fields.donor_name_mr) {
    formData.set("donor_name_mr", entry.fields.donor_name_mr);
  }
  formData.set("amount", String(entry.fields.amount));
  formData.set("phone_number", entry.fields.phone_number);
  formData.set("payment_method", entry.fields.payment_method);
  formData.set("collection_date", entry.fields.collection_date);

  // Without these two the schema's `.default("Paid")` takes over, and a pledge
  // recorded offline would replay as money actually received — ₹0 collected
  // becoming a real total, and the row vanishing from the due list. Entries
  // queued by a build older than these fields still fall back to that default,
  // which is why the send is conditional rather than assumed.
  if (entry.fields.payment_status) {
    formData.set("payment_status", entry.fields.payment_status);
  }
  if (entry.fields.due_on) {
    formData.set("due_on", entry.fields.due_on);
  }

  // The volunteer already decided to record this while offline; there is no
  // one to re-prompt at flush time, so the duplicate guard is pre-answered.
  formData.set("confirm_duplicate", "1");

  if (entry.expectedUpdatedAt) {
    formData.set("expected_updated_at", entry.expectedUpdatedAt);
  }
  return formData;
}

/**
 * Replays queued writes, oldest first, stopping at the first network failure so
 * ordering is preserved. Safe to call repeatedly.
 */
export async function flushOutbox(): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, conflicts: 0, failed: 0 };
  const entries = await readOutbox();

  for (const entry of entries) {
    try {
      const outcome =
        entry.kind === "create"
          ? await createReceipt(toFormData(entry))
          : entry.kind === "update" && entry.receiptId
            ? await updateReceipt(entry.receiptId, toFormData(entry))
            : entry.receiptId
              ? await deleteReceipt(entry.receiptId)
              : ({ ok: false, error: "Malformed queue entry" } as const);

      if (outcome.ok) {
        await dequeue(entry.localId);
        result.synced += 1;
        continue;
      }

      // Someone edited the same receipt while this device was offline. Keeping
      // the entry would retry forever, so drop it and report it — the audit log
      // still shows what the other volunteer changed.
      if ("conflict" in outcome) {
        await dequeue(entry.localId);
        result.conflicts += 1;
        continue;
      }

      // A validation error will never succeed on retry either.
      await dequeue(entry.localId);
      result.failed += 1;
    } catch {
      // Network still down, or the action threw. Leave it queued and stop, so
      // later entries do not overtake this one.
      const attempts = entry.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await dequeue(entry.localId);
        result.failed += 1;
        continue;
      }
      // Persisted, not just counted locally: the count has to survive this
      // flush or it is always 1, MAX_ATTEMPTS is never reached, and a genuinely
      // stuck entry (an expired session throwing on every replay) blocks every
      // receipt queued behind it forever, with no way out from the UI.
      await enqueue({ ...entry, attempts });
      break;
    }
  }

  await setMeta("lastFlush", new Date().toISOString());
  return result;
}
