import { describe, expect, it } from "vitest";
import {
  parseRange,
  parseSort,
  parseStatus,
  reportUrl,
  type ReportRange,
  type ReportStatus,
} from "@/app/dashboard/report/report-range";
import type { SortKey } from "@/app/dashboard/sort-rows";
import { todayInIst } from "@/lib/receipt-utils";

describe("parseRange", () => {
  it("defaults to all time", () => {
    expect(parseRange({})).toEqual({ key: "all", from: null, to: null });
  });

  it("resolves the today preset in the mandal's zone", () => {
    const today = todayInIst();
    expect(parseRange({ range: "today" })).toEqual({
      key: "today",
      from: today,
      to: today,
    });
  });

  it("reads a custom pair", () => {
    expect(parseRange({ from: "2026-08-01", to: "2026-08-10" })).toEqual({
      key: "custom",
      from: "2026-08-01",
      to: "2026-08-10",
    });
  });

  it("accepts a half-open range", () => {
    expect(parseRange({ from: "2026-08-01" })).toEqual({
      key: "custom",
      from: "2026-08-01",
      to: null,
    });
  });

  it("swaps a range typed back-to-front", () => {
    const range = parseRange({ from: "2026-08-10", to: "2026-08-01" });
    expect([range.from, range.to]).toEqual(["2026-08-01", "2026-08-10"]);
  });

  it("ignores junk dates rather than erroring", () => {
    expect(parseRange({ from: "yesterday", to: "2026-13-99" })).toEqual({
      key: "all",
      from: null,
      to: null,
    });
  });

  it("rejects a day the calendar does not have", () => {
    // Shape-valid, so it would otherwise reach Postgres as a date comparison.
    expect(parseRange({ from: "2026-02-31" }).from).toBeNull();
  });

  it("takes the first value when a param repeats", () => {
    expect(parseRange({ from: ["2026-08-01", "2026-09-01"] }).from).toBe(
      "2026-08-01",
    );
  });
});

describe("parseStatus", () => {
  it("defaults to both statuses", () => {
    expect(parseStatus({})).toBe("all");
  });

  it("reads the three narrowing values", () => {
    expect(parseStatus({ status: "paid" })).toBe("Paid");
    expect(parseStatus({ status: "unpaid" })).toBe("Unpaid");
    expect(parseStatus({ status: "donation" })).toBe("Donation");
  });

  it("is case-insensitive, since these end up hand-typed", () => {
    expect(parseStatus({ status: "Paid" })).toBe("Paid");
    expect(parseStatus({ status: "UNPAID" })).toBe("Unpaid");
  });

  it("ignores anything else rather than printing nothing", () => {
    expect(parseStatus({ status: "junk" })).toBe("all");
  });

  it("takes the first value when the param repeats", () => {
    expect(parseStatus({ status: ["unpaid", "paid"] })).toBe("Unpaid");
  });
});

/*
 * reportUrl is the filter sheet's single commit: a volunteer stages status,
 * period and order, and Done turns the whole draft into one navigation. So
 * the property that matters is not what the string looks like, it is that
 * parsing it back yields the selection it was built from — anything else means
 * the report on screen, and then on paper, covers different rows than the ones
 * asked for.
 */
describe("reportUrl", () => {
  const params = (url: string) =>
    Object.fromEntries(new URL(url, "http://x").searchParams);

  const roundTrip = (v: {
    status: ReportStatus;
    range: ReportRange;
    sort: SortKey;
  }) => {
    const p = params(reportUrl(v));
    return {
      status: parseStatus(p),
      range: parseRange(p),
      sort: parseSort(p),
    };
  };

  const all: ReportRange = { key: "all", from: null, to: null };

  it("writes no query string for the default selection", () => {
    expect(reportUrl({ status: "all", range: all, sort: "date-asc" })).toBe(
      "/dashboard/report",
    );
  });

  it("round-trips every status", () => {
    for (const status of [
      "all",
      "Paid",
      "Unpaid",
      "Donation",
      "Expense",
    ] as const) {
      expect(roundTrip({ status, range: all, sort: "date-asc" }).status).toBe(
        status,
      );
    }
  });

  it("round-trips a custom range, including one open bound", () => {
    for (const range of [
      { key: "custom", from: "2026-09-01", to: "2026-09-10" },
      { key: "custom", from: "2026-09-01", to: null },
      { key: "custom", from: null, to: "2026-09-10" },
    ] as ReportRange[]) {
      expect(
        roundTrip({ status: "all", range, sort: "date-asc" }).range,
      ).toEqual(range);
    }
  });

  it("round-trips a non-default sort", () => {
    expect(
      roundTrip({ status: "all", range: all, sort: "amount-desc" }).sort,
    ).toBe("amount-desc");
  });

  it("keeps all three parts of a combined selection", () => {
    const v = {
      status: "Unpaid" as ReportStatus,
      range: { key: "custom", from: "2026-09-01", to: "2026-09-30" } as ReportRange,
      sort: "amount-desc" as SortKey,
    };
    expect(roundTrip(v)).toEqual(v);
  });

  it("drops custom bounds when a preset is chosen", () => {
    // The sheet clears from/to when a preset is tapped; this makes sure a
    // stale bound cannot ride along in the URL and re-narrow the report.
    const url = reportUrl({
      status: "all",
      range: { key: "today", from: "2026-09-01", to: "2026-09-30" },
      sort: "date-asc",
    });
    expect(params(url)).toEqual({ range: "today" });
  });
});
