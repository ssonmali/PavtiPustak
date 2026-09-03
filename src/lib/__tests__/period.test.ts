import { describe, expect, it } from "vitest";
import {
  ALL_TIME,
  filterByPeriod,
  inPeriod,
  isPeriodFiltered,
  isSingleDay,
  LAST_7,
  periodLabelKey,
  rangeOf,
  samePeriod,
  TODAY,
  type Period,
} from "@/app/dashboard/period";
import { dictionaries } from "@/lib/i18n/dictionaries";

const custom = (from: string | null, to: string | null): Period => ({
  kind: "custom",
  from,
  to,
});

const rows = ["2026-08-30", "2026-09-05", "2026-09-10"].map((d) => ({
  collection_date: d,
}));
const days = (out: { collection_date: string }[]) =>
  out.map((r) => r.collection_date);

describe("rangeOf", () => {
  it("leaves all-time unbounded", () => {
    expect(rangeOf(ALL_TIME)).toEqual({ from: null, to: null });
  });

  it("gives a rolling window an open end", () => {
    const { from, to } = rangeOf(LAST_7);
    expect(to).toBeNull();
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("counts today as one day, not zero", () => {
    expect(rangeOf(TODAY).from).toBe(rangeOf({ kind: "days", days: 1 }).from);
  });

  // A range typed back to front is a slip, not a request for an empty ledger.
  it("swaps a back-to-front custom range", () => {
    expect(rangeOf(custom("2026-09-10", "2026-09-01"))).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
  });

  it("keeps a half-open custom range", () => {
    expect(rangeOf(custom("2026-09-01", null))).toEqual({
      from: "2026-09-01",
      to: null,
    });
  });
});

describe("filterByPeriod", () => {
  it("returns everything for all time", () => {
    expect(filterByPeriod(rows, ALL_TIME)).toHaveLength(3);
  });

  it("applies both bounds of a custom range, inclusively", () => {
    expect(days(filterByPeriod(rows, custom("2026-08-30", "2026-09-05")))).toEqual(
      ["2026-08-30", "2026-09-05"],
    );
  });

  it("applies a lone start bound", () => {
    expect(days(filterByPeriod(rows, custom("2026-09-05", null)))).toEqual([
      "2026-09-05",
      "2026-09-10",
    ]);
  });

  it("applies a lone end bound", () => {
    expect(days(filterByPeriod(rows, custom(null, "2026-09-05")))).toEqual([
      "2026-08-30",
      "2026-09-05",
    ]);
  });
});

describe("inPeriod", () => {
  it("includes the boundary days", () => {
    const p = custom("2026-09-01", "2026-09-30");
    expect(inPeriod("2026-09-01", p)).toBe(true);
    expect(inPeriod("2026-09-30", p)).toBe(true);
    expect(inPeriod("2026-08-31", p)).toBe(false);
    expect(inPeriod("2026-10-01", p)).toBe(false);
  });
});

describe("samePeriod", () => {
  it("separates the presets", () => {
    expect(samePeriod(TODAY, TODAY)).toBe(true);
    expect(samePeriod(TODAY, LAST_7)).toBe(false);
    expect(samePeriod(ALL_TIME, TODAY)).toBe(false);
  });

  it("compares custom ranges by their bounds", () => {
    expect(samePeriod(custom("a", "b"), custom("a", "b"))).toBe(true);
    expect(samePeriod(custom("a", "b"), custom("a", "c"))).toBe(false);
  });
});

describe("isSingleDay", () => {
  it("is true for today and for a one-day custom range", () => {
    expect(isSingleDay(TODAY)).toBe(true);
    expect(isSingleDay(custom("2026-09-01", "2026-09-01"))).toBe(true);
  });

  it("is false for wider windows", () => {
    expect(isSingleDay(LAST_7)).toBe(false);
    expect(isSingleDay(ALL_TIME)).toBe(false);
    expect(isSingleDay(custom("2026-09-01", "2026-09-02"))).toBe(false);
  });
});

/*
 * The two helpers the collapsed filter button reads.
 *
 * Worth testing rather than eyeballing because the failure is silent and
 * specific: a filter sheet hides the filter, so if the button says "All time"
 * while a custom range is on, nothing on screen contradicts it — and this is
 * a ledger, where a volunteer reading a partial total as the whole is the
 * error the button exists to prevent.
 */
describe("isPeriodFiltered", () => {
  it("is false only for the whole ledger", () => {
    expect(isPeriodFiltered(ALL_TIME)).toBe(false);
    expect(isPeriodFiltered(TODAY)).toBe(true);
    expect(isPeriodFiltered(LAST_7)).toBe(true);
    expect(isPeriodFiltered(custom("2026-09-01", null))).toBe(true);
  });

  it("counts a custom range that happens to be open-ended", () => {
    // Both bounds null is not reachable from the UI — CustomDateRange sends
    // ALL_TIME instead — but it must not read as unfiltered if it ever is.
    expect(isPeriodFiltered(custom(null, null))).toBe(true);
  });
});

describe("periodLabelKey", () => {
  it("names each preset", () => {
    expect(periodLabelKey(TODAY)).toBe("period.today");
    expect(periodLabelKey(LAST_7)).toBe("period.7");
    expect(periodLabelKey(ALL_TIME)).toBe("period.all");
  });

  it("returns keys that actually exist in both dictionaries", () => {
    // periodLabelKey returns a translation KEY, so a typo in it renders the
    // raw key on the filter button rather than failing anywhere loud.
    for (const p of [TODAY, LAST_7, ALL_TIME, custom("2026-09-01", null)]) {
      const key = periodLabelKey(p);
      expect(dictionaries.en, key).toHaveProperty(key);
      expect(dictionaries.mr, key).toHaveProperty(key);
    }
  });

  it("never calls a custom range 'all time'", () => {
    // The regression this guards: `custom` is not one of the presets, so a
    // preset-only lookup fell through to "period.all" and labelled a filtered
    // view as the unfiltered one.
    for (const p of [
      custom("2026-09-01", "2026-09-10"),
      custom("2026-09-01", null),
      custom(null, "2026-09-10"),
    ]) {
      expect(periodLabelKey(p)).toBe("period.custom");
    }
  });
});
