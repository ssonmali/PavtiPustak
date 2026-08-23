export const SORT_KEYS = [
  "date-desc",
  "date-asc",
  "amount-desc",
  "amount-asc",
  "name-asc",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

/** Newest first, matching the order the server sends. */
export const DEFAULT_SORT: SortKey = "date-desc";

/**
 * How to read the three sortable things off a row. Receipts and expenses keep
 * them under different column names, so the comparator asks rather than knows.
 */
export type SortFields<T> = {
  /** An ISO `YYYY-MM-DD` day, which compares correctly as a string. */
  date: (row: T) => string;
  /** Postgres numeric arrives as a string, so this is coerced, not added. */
  amount: (row: T) => number | string;
  name: (row: T) => string;
};

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Sorts a copy, never the input: callers pass memoised arrays that React holds
 * on to, and sorting one in place would mutate a previous render's value.
 *
 * Ties keep the order they arrived in — JavaScript's sort is stable — so rows
 * on the same day stay in the server's receipt-number order.
 */
export function sortRows<T>(
  rows: T[],
  key: SortKey,
  fields: SortFields<T>,
  locale?: string,
): T[] {
  const out = [...rows];

  switch (key) {
    case "date-desc":
      return out.sort((a, b) => byString(fields.date(b), fields.date(a)));
    case "date-asc":
      return out.sort((a, b) => byString(fields.date(a), fields.date(b)));
    case "amount-desc":
      return out.sort((a, b) => Number(fields.amount(b)) - Number(fields.amount(a)));
    case "amount-asc":
      return out.sort((a, b) => Number(fields.amount(a)) - Number(fields.amount(b)));
    case "name-asc":
      // Collated, not byte-compared: Devanagari and Latin names both sort by
      // the reader's alphabet rather than by code point.
      return out.sort((a, b) =>
        fields.name(a).localeCompare(fields.name(b), locale),
      );
  }
}
