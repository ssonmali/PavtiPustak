import { outstanding, received, type Money } from "@/lib/receipt-utils";

/**
 * Unpaid pledges reduced to one row per day.
 *
 * The shape is the contract between two implementations of the same figures:
 * `public.pledge_daily_totals` (migration 18) and the function below. The view
 * stops the payload growing with the ledger, the function keeps the pages
 * working before the migration is run by hand — and the risk of two is drift,
 * so the test pins the function to numbers from the view on a real Postgres.
 */
export type PledgeDay = {
  /** The day the pledges were recorded, not when they fall due. */
  collection_date: string;
  outstanding_total: number;
  pledge_rows: number;
  pledge_only_count: number;
  owing_count: number;
};

/** A raw unpaid row, as the fallback query selects it. */
export type PledgeRow = Money & { collection_date: string };

/**
 * No "server-only" and no Supabase import, so it can be tested directly —
 * which is why the fallback is trustworthy at all.
 *
 * Expressed via received() and outstanding() rather than reimplementing them:
 * those are what the app means by "brought in nothing" and "still owes", and
 * the view's columns are their SQL equivalents. Two definitions of one rule,
 * held together by a test, rather than three.
 */
export function aggregatePledgeDays(rows: PledgeRow[]): PledgeDay[] {
  const byDay = new Map<string, PledgeDay>();

  for (const row of rows) {
    const day = byDay.get(row.collection_date) ?? {
      collection_date: row.collection_date,
      outstanding_total: 0,
      pledge_rows: 0,
      pledge_only_count: 0,
      owing_count: 0,
    };

    day.outstanding_total += outstanding(row);
    // Every unpaid row in the day, however much has come in against it.
    day.pledge_rows += 1;
    // Nothing in at all. The daily totals view counts only receipts that
    // contributed money, so the overview adds these to reach "every receipt
    // written in the window".
    if (received(row) === 0) day.pledge_only_count += 1;
    // A row whose remainder has reached zero is not still owed, even while
    // its status says Unpaid.
    if (outstanding(row) > 0) day.owing_count += 1;

    byDay.set(row.collection_date, day);
  }

  return [...byDay.values()];
}
