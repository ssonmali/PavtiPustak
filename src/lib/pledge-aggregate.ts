import { outstanding, received, type Money } from "@/lib/receipt-utils";

/**
 * Unpaid pledges reduced to one row per day.
 *
 * The shape is the contract between two implementations of the same four
 * figures: `public.pledge_daily_totals` in SQL (migration 18) and `aggregate`
 * below. Both are needed — the view is what makes the payload stop growing
 * with the ledger, the function is what keeps the pages working before the
 * migration has been run by hand in the dashboard — and the whole risk of
 * having two is that they drift. pledge-aggregate.test.ts pins the function to
 * numbers taken from the view running on a real Postgres.
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
 * Its own module, with no "server-only" and no Supabase import, so it can be
 * tested directly — the reason the fallback is trustworthy at all.
 *
 * Expressed in terms of received() and outstanding() rather than
 * reimplementing them: those two functions are what the rest of the app means
 * by "brought in nothing" and "still owes", and the view's own columns are
 * their SQL equivalents. Three definitions of one rule would be one too many;
 * this way there are two, and a test holds them together.
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
