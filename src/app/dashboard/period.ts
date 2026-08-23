import { toDateValue } from "@/lib/receipt-utils";

/**
 * The window a ledger is being read through: a rolling number of days, the
 * whole ledger, or an explicit range the volunteer picked.
 */
export type Period =
  | { kind: "days"; days: number }
  | { kind: "all" }
  | { kind: "custom"; from: string | null; to: string | null };

export const TODAY: Period = { kind: "days", days: 1 };
export const LAST_7: Period = { kind: "days", days: 7 };
export const ALL_TIME: Period = { kind: "all" };

/** The presets offered as buttons, in order. */
export const PRESETS: Period[] = [TODAY, LAST_7, ALL_TIME];

/** Inclusive bounds as `YYYY-MM-DD`, or null for open-ended. */
export function rangeOf(period: Period): {
  from: string | null;
  to: string | null;
} {
  if (period.kind === "all") return { from: null, to: null };

  if (period.kind === "custom") {
    // A range typed back to front is a slip, not a request for nothing.
    if (period.from && period.to && period.from > period.to) {
      return { from: period.to, to: period.from };
    }
    return { from: period.from, to: period.to };
  }

  const start = new Date();
  start.setDate(start.getDate() - (period.days - 1));
  return { from: toDateValue(start), to: null };
}

/** Whether a `YYYY-MM-DD` day falls inside the window. */
export function inPeriod(day: string, period: Period): boolean {
  const { from, to } = rangeOf(period);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function filterByPeriod<T extends { collection_date: string }>(
  rows: T[],
  period: Period,
): T[] {
  const { from, to } = rangeOf(period);
  if (!from && !to) return rows;
  return rows.filter((row) => {
    if (from && row.collection_date < from) return false;
    if (to && row.collection_date > to) return false;
    return true;
  });
}

/** True when the two describe the same window, for marking a preset active. */
export function samePeriod(a: Period, b: Period): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "days" && b.kind === "days") return a.days === b.days;
  if (a.kind === "custom" && b.kind === "custom") {
    return a.from === b.from && a.to === b.to;
  }
  return true;
}

/** A single day is showing, so a day-by-day chart would be one bar. */
export function isSingleDay(period: Period): boolean {
  if (period.kind === "days") return period.days === 1;
  if (period.kind === "custom") {
    return Boolean(period.from) && period.from === period.to;
  }
  return false;
}
