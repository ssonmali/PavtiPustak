import { describe, expect, it } from "vitest";
import { planRestore } from "@/lib/restore-receipt";

/** A snapshot shaped like one the audit trigger writes on a delete. */
function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    receipt_number: 101,
    donor_name: "Sanket Sonmali",
    donor_name_mr: "संकेत सोनमाळी",
    amount: 2500,
    paid_amount: null,
    phone_number: "9876543210",
    payment_method: "Cash",
    collection_date: "2026-09-01",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    created_by_email: "volunteer@mandal.org",
    payment_status: "Paid",
    due_on: null,
    ...overrides,
  };
}

const deletion = (before: unknown = snapshot()) => ({
  action: "deleted",
  before,
});

describe("planRestore", () => {
  it("restores a deleted receipt from its snapshot", () => {
    const plan = planRestore(deletion(), false);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.fields.receipt_number).toBe(101);
    expect(plan.fields.donor_name).toBe("Sanket Sonmali");
    expect(plan.fields.amount).toBe(2500);
  });

  it("keeps the identity, so the receipt matches the donor's paper slip", () => {
    const plan = planRestore(deletion(), false);
    if (!plan.ok) throw new Error("expected a restorable plan");
    // The whole point: same number, same id, same author as before the delete.
    expect(plan.fields.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(plan.fields.user_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(plan.fields.created_by_email).toBe("volunteer@mandal.org");
    // And the original collection date, not today.
    expect(plan.fields.collection_date).toBe("2026-09-01");
    expect(plan.fields.created_at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("refuses an entry that is not a deletion", () => {
    expect(planRestore({ action: "updated", before: snapshot() }, false)).toEqual(
      { ok: false, reason: "not-restorable" },
    );
    expect(planRestore({ action: "created", before: null }, false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
  });

  it("refuses a deletion with no snapshot to restore from", () => {
    expect(planRestore(deletion(null), false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
    expect(planRestore(deletion("not an object"), false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
    expect(planRestore(deletion([1, 2, 3]), false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
  });

  it("refuses a snapshot missing a field that makes the row a receipt", () => {
    for (const missing of [
      "id",
      "receipt_number",
      "donor_name",
      "collection_date",
    ]) {
      const partial = snapshot({ [missing]: undefined });
      expect(planRestore(deletion(partial), false), missing).toEqual({
        ok: false,
        reason: "not-restorable",
      });
    }
  });

  it("reports already-exists rather than restoring twice", () => {
    expect(planRestore(deletion(), true)).toEqual({
      ok: false,
      reason: "already-exists",
    });
  });

  it("checks the snapshot before the double-tap, so the reason is honest", () => {
    // A malformed entry that also exists is "not-restorable", not
    // "already-exists" — the volunteer should hear the real problem.
    expect(planRestore(deletion(null), true)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
  });

  it("carries a part-paid pledge back with both halves intact", () => {
    const plan = planRestore(
      deletion(
        snapshot({
          payment_status: "Unpaid",
          amount: 5000,
          paid_amount: 2000,
          due_on: "2026-09-20",
        }),
      ),
      false,
    );
    if (!plan.ok) throw new Error("expected a restorable plan");
    expect(plan.fields.payment_status).toBe("Unpaid");
    expect(plan.fields.amount).toBe(5000);
    expect(plan.fields.paid_amount).toBe(2000);
    expect(plan.fields.due_on).toBe("2026-09-20");
  });

  it("treats a blank Marathi name as absent, matching the column's meaning", () => {
    const plan = planRestore(deletion(snapshot({ donor_name_mr: "" })), false);
    if (!plan.ok) throw new Error("expected a restorable plan");
    expect(plan.fields.donor_name_mr).toBeNull();
  });

  it("handles numerics arriving as strings, as jsonb hands them back", () => {
    const plan = planRestore(
      deletion(snapshot({ amount: "2500.00", paid_amount: "500.50" })),
      false,
    );
    if (!plan.ok) throw new Error("expected a restorable plan");
    expect(plan.fields.amount).toBe(2500);
    expect(plan.fields.paid_amount).toBe(500.5);
  });

  it("refuses a missing audit row", () => {
    expect(planRestore(null, false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
    expect(planRestore(undefined, false)).toEqual({
      ok: false,
      reason: "not-restorable",
    });
  });
});
