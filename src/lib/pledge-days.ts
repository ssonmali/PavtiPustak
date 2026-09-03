import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  aggregatePledgeDays,
  type PledgeDay,
  type PledgeRow,
} from "@/lib/pledge-aggregate";

export type { PledgeDay } from "@/lib/pledge-aggregate";

/** Matches receipt_daily_totals' cap: this is a row per day, not per receipt. */
const MAX_DAYS = 400;
/** Only used by the fallback below, and the cap the raw query always had. */
const MAX_ROWS = 1000;

/**
 * Unpaid pledges, one row per day they were recorded on.
 *
 * The overview and the receipts ledger need the same four figures over a
 * period: what is still owed, how many pledges there are, how many have
 * brought in nothing yet, and how many still owe something. Both used to
 * fetch up to 1000 raw unpaid rows and derive those on the client, which meant
 * switching between the two tabs re-sent the same 1000 rows to compute the
 * same numbers twice. Aggregated in the database, the payload is one row per
 * day that has pledges on it — the same trick receipt_daily_totals already
 * plays for money in.
 *
 * `cache()` for the same reason getUser has it: two callers in one render
 * would otherwise ask twice.
 *
 * The fallback is not defensive padding. Migrations here are run by hand in
 * the Supabase dashboard, so code can reach production before migration 18
 * does; without it, that window is a broken overview and a broken ledger
 * rather than a slower one. Being wrong the other way costs one round trip on
 * a query that was about to run anyway. The two paths are held to the same
 * numbers by pledge-aggregate.test.ts.
 */
export const getPledgeDays = cache(async (): Promise<PledgeDay[]> => {
  const supabase = await createClient();

  const view = await supabase
    .from("pledge_daily_totals")
    .select("*")
    .order("collection_date", { ascending: false })
    .limit(MAX_DAYS);

  if (!view.error && view.data) {
    // numeric arrives as a string over the wire — these are money sums.
    return view.data.map((d) => ({
      collection_date: d.collection_date as string,
      outstanding_total: Number(d.outstanding_total ?? 0),
      pledge_rows: Number(d.pledge_rows ?? 0),
      pledge_only_count: Number(d.pledge_only_count ?? 0),
      owing_count: Number(d.owing_count ?? 0),
    }));
  }

  const raw = await supabase
    .from("receipts")
    .select("amount, paid_amount, payment_status, collection_date")
    .eq("payment_status", "Unpaid")
    .limit(MAX_ROWS);

  return aggregatePledgeDays((raw.data ?? []) as PledgeRow[]);
});
