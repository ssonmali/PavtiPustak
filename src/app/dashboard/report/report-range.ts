import { todayInIst } from "@/lib/receipt-utils";
import { SORT_KEYS, type SortKey } from "../sort-rows";

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
/** What a report may be narrowed to. */
export type ReportStatus = "all" | "Paid" | "Unpaid" | "Donation" | "Expense";

/**
 * `?status=paid|unpaid|donation|expense` narrows the report; anything else
 * means all.
 */
export function parseStatus(
  params: Record<string, string | string[] | undefined>,
): ReportStatus {
  const raw = (
    Array.isArray(params.status) ? params.status[0] : params.status
  )?.toLowerCase();
  if (raw === "paid") return "Paid";
  if (raw === "unpaid") return "Unpaid";
  if (raw === "donation") return "Donation";
  if (raw === "expense") return "Expense";
  return "all";
}

/**
 * `?sort=` picks the printed order. Oldest first by default, which is the
 * order the query returns and how a ledger reads on paper; anything
 * unrecognised falls back to it rather than erroring a print job.
 */
export const DEFAULT_REPORT_SORT: SortKey = "date-asc";

export function parseSort(
  params: Record<string, string | string[] | undefined>,
): SortKey {
  const raw = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  return SORT_KEYS.includes(raw as SortKey)
    ? (raw as SortKey)
    : DEFAULT_REPORT_SORT;
}

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
