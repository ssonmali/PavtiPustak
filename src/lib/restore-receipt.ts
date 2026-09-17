import type { Receipt } from "@/lib/types";

/**
 * The columns a restore writes back.
 *
 * Deliberately the whole identity — id, receipt_number, user_id,
 * created_by_email — and not just the donor/money fields a normal save sends.
 * A restored receipt that came back under a new number or a new author would
 * not match the paper slip in the donor's hand, which is the only reason the
 * feature exists.
 *
 * `updated_at` is left out: a trigger owns it, and the restored row genuinely
 * is being written now.
 */
export type RestoreFields = Pick<
  Receipt,
  | "id"
  | "receipt_number"
  | "donor_name"
  | "donor_name_mr"
  | "amount"
  | "paid_amount"
  | "phone_number"
  | "payment_method"
  | "collection_date"
  | "created_at"
  | "user_id"
  | "created_by_email"
  | "payment_status"
  | "due_on"
>;

/** Why a restore cannot go ahead, or the row to insert if it can. */
export type RestorePlan =
  | { ok: true; fields: RestoreFields }
  /** The audit row is not a deletion, or carries no snapshot to restore from. */
  | { ok: false; reason: "not-restorable" }
  /** Someone has already restored it, or the id came back another way. */
  | { ok: false; reason: "already-exists" };

/** The audit columns this module needs; the table has more. */
type AuditRow = {
  action: string;
  before: unknown;
};

/**
 * Reads a receipt back out of an audit snapshot.
 *
 * Split from the action so the guards are testable without a database: the
 * expensive half of a restore is deciding whether it is allowed, and every one
 * of those decisions is a pure function of the snapshot.
 *
 * Returns `not-restorable` rather than throwing for a bad row, because the
 * caller turns it into a message and there is nothing exceptional about a
 * volunteer tapping restore on an entry that cannot supply one.
 */
export function planRestore(
  audit: AuditRow | null | undefined,
  exists: boolean,
): RestorePlan {
  if (!audit || audit.action !== "deleted") {
    return { ok: false, reason: "not-restorable" };
  }

  const before = audit.before;
  if (!before || typeof before !== "object" || Array.isArray(before)) {
    return { ok: false, reason: "not-restorable" };
  }

  const snapshot = before as Record<string, unknown>;

  // The four that make the row itself. Without any of them the restore would
  // silently invent a receipt rather than bring one back.
  const id = snapshot.id;
  const receiptNumber = snapshot.receipt_number;
  const donorName = snapshot.donor_name;
  const collectionDate = snapshot.collection_date;
  if (
    typeof id !== "string" ||
    typeof receiptNumber !== "number" ||
    typeof donorName !== "string" ||
    typeof collectionDate !== "string"
  ) {
    return { ok: false, reason: "not-restorable" };
  }

  // Checked after the shape, so a double-tap on a valid entry reports the
  // honest reason rather than "not restorable".
  if (exists) return { ok: false, reason: "already-exists" };

  return {
    ok: true,
    fields: {
      id,
      receipt_number: receiptNumber,
      donor_name: donorName,
      donor_name_mr: asStringOrNull(snapshot.donor_name_mr),
      amount: Number(snapshot.amount),
      paid_amount:
        snapshot.paid_amount == null ? null : Number(snapshot.paid_amount),
      phone_number: String(snapshot.phone_number ?? ""),
      payment_method: (snapshot.payment_method ??
        "Cash") as Receipt["payment_method"],
      collection_date: collectionDate,
      // Kept, not reset to now: a restored receipt was collected when it was
      // collected, and the ledger sorts and reports on these dates.
      created_at: String(snapshot.created_at ?? new Date().toISOString()),
      user_id: String(snapshot.user_id ?? ""),
      created_by_email: asStringOrNull(snapshot.created_by_email),
      payment_status: (snapshot.payment_status ??
        "Paid") as Receipt["payment_status"],
      due_on: asStringOrNull(snapshot.due_on),
    },
  };
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
