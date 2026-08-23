import { describe, expect, it } from "vitest";
import {
  parseRange,
  parseStatus,
} from "@/app/dashboard/report/report-range";
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

  it("reads the two narrowing values", () => {
    expect(parseStatus({ status: "paid" })).toBe("Paid");
    expect(parseStatus({ status: "unpaid" })).toBe("Unpaid");
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
