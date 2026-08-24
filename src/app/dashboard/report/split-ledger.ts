import { outstanding, received, type Money } from "@/lib/receipt-utils";

/**
 * Which printed section each row belongs in.
 *
 * A part-paid row belongs in **both** — its received half under Received, its
 * remainder under Unpaid — because the report is checked by adding a column up
 * and comparing it with the summary. Splitting on `payment_status` instead put
 * the whole row in one section, so the received half of a part-paid
 * contribution was inside the summary's collected total but nowhere in the
 * section below it.
 *
 * Pure and separate from the page so the reconciliation can be tested.
 */
export function splitLedger<T extends Money>(rows: T[]) {
  return {
    /** Rows with money that has moved, listed at what actually moved. */
    settled: rows.filter((r) => received(r) > 0),
    /** Rows with money still owed, listed at what is still owed. */
    open: rows.filter((r) => outstanding(r) > 0),
  };
}
