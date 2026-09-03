import { describe, expect, it } from "vitest";
import {
  aggregatePledgeDays,
  type PledgeRow,
} from "@/lib/pledge-aggregate";

/**
 * The expected numbers here are not hand-derived: they were produced by
 * `public.pledge_daily_totals` from migration 18, running on a real Postgres
 * with migrations 01..18 replayed and these exact five rows inserted.
 *
 * That is the point of the test. There are two implementations of these four
 * figures — the view, which is what the pages actually read, and this
 * function, which covers the window before the migration has been run by hand
 * in the Supabase dashboard. Two implementations of one rule drift; this pins
 * them together, and it pins them to the SQL rather than to my arithmetic.
 */
const rows: PledgeRow[] = [
  // Day A. The four cases the figures distinguish.
  { collection_date: "2026-09-01", amount: 1000, paid_amount: null, payment_status: "Unpaid" },
  { collection_date: "2026-09-01", amount: 1000, paid_amount: 400, payment_status: "Unpaid" },
  // Settled: excluded by the query that feeds this, and by the view's WHERE.
  { collection_date: "2026-09-01", amount: 1000, paid_amount: null, payment_status: "Paid" },
  // Unpaid, but the remainder has reached zero.
  { collection_date: "2026-09-01", amount: 1000, paid_amount: 1000, payment_status: "Unpaid" },
  { collection_date: "2026-09-02", amount: 500, paid_amount: null, payment_status: "Unpaid" },
];

/** What the query sends: unpaid rows only. */
const unpaid = rows.filter((r) => r.payment_status === "Unpaid");

describe("aggregatePledgeDays", () => {
  it("matches pledge_daily_totals on the same rows", () => {
    expect(aggregatePledgeDays(unpaid)).toEqual([
      {
        collection_date: "2026-09-01",
        // 1000 owed + 600 remaining + 0 on the fully prepaid row.
        outstanding_total: 1600,
        pledge_rows: 3,
        pledge_only_count: 1,
        owing_count: 2,
      },
      {
        collection_date: "2026-09-02",
        outstanding_total: 500,
        pledge_rows: 1,
        pledge_only_count: 1,
        owing_count: 1,
      },
    ]);
  });

  it("counts a row that owes nothing as a pledge but not as owing", () => {
    // The case worth its own test: payment_status is Unpaid, so it belongs to
    // the ledger's unpaid set and must be counted in pledge_rows, but there is
    // nothing left to chase — so it must not inflate the "yet to receive"
    // count on the overview.
    const [day] = aggregatePledgeDays([
      { collection_date: "2026-09-01", amount: 1000, paid_amount: 1000, payment_status: "Unpaid" },
    ]);
    expect(day.pledge_rows).toBe(1);
    expect(day.owing_count).toBe(0);
    expect(day.pledge_only_count).toBe(0);
    expect(day.outstanding_total).toBe(0);
  });

  it("does not double-count a part payment", () => {
    // The received half is already inside the collected total, so only the
    // remainder may appear here — otherwise the overview's Estimated tile,
    // which adds the two, counts that money twice.
    const [day] = aggregatePledgeDays([
      { collection_date: "2026-09-01", amount: 1000, paid_amount: 400, payment_status: "Unpaid" },
    ]);
    expect(day.outstanding_total).toBe(600);
    expect(day.pledge_only_count).toBe(0);
  });

  it("returns nothing for no rows", () => {
    expect(aggregatePledgeDays([])).toEqual([]);
  });
});
