import { todayInIst } from "@/lib/receipt-utils";

/** Presets the print toolbar offers; anything else is a custom date pair. */
export type RangeKey = "today" | "custom" | "all";

export type ReportRange = {
  key: RangeKey;
  /** Inclusive `YYYY-MM-DD` bounds; null means unbounded on that side. */
  from: string | null;
  to: string | null;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real calendar day, or null. The shape check alone is not enough: month 13
 * passes it and then reaches Postgres as a date comparison, which errors.
 */
function day(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !ISO_DAY.test(raw)) return null;
  // Parsed as UTC, so this never shifts a day; round-tripping rejects overflow
  // like 2026-02-31, which Date would otherwise roll into March.
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === raw ? raw : null;
}

/**
 * Reads the range out of the query string. Unparseable or missing values fall
 * back to all time rather than erroring — a printed report is not worth a 400.
 */
export function parseRange(
  params: Record<string, string | string[] | undefined>,
): ReportRange {
  const preset = Array.isArray(params.range) ? params.range[0] : params.range;

  if (preset === "today") {
    const today = todayInIst();
    return { key: "today", from: today, to: today };
  }

  let from = day(params.from);
  let to = day(params.to);

  // A range typed back-to-front is a slip, not a request for nothing.
  if (from && to && from > to) [from, to] = [to, from];

  if (from || to) return { key: "custom", from, to };
  return { key: "all", from: null, to: null };
}
