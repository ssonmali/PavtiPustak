import { describe, expect, it } from "vitest";
import {
  ALL_TIME,
  filterByPeriod,
  inPeriod,
  isSingleDay,
  LAST_7,
  rangeOf,
  samePeriod,
  TODAY,
  type Period,
} from "@/app/dashboard/period";

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
