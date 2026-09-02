import { rangeOf, type Period } from "./period";
import type { StatusFilter } from "./status-filter";
import { DEFAULT_SORT, SORT_KEYS, type SortKey } from "./sort-rows";

/**
 * Reading the receipts list's four controls out of the URL, and turning them
 * into a database query.
 *
 * The controls live in the URL so they survive navigation — switching tabs
 * unmounted the state that used to hold them — and so a Server Component can
 * build the query before the first paint. Everything here is pure: no React,
 * no Supabase client, so it can be tested directly.
 */

/** Rows per page. Matches the range the receipts page has always sent. */
export const DEFAULT_LIMIT = 50;
/**
 * `fetchReceipts` is a server action, which is to say a public HTTP endpoint.
 * Without a ceiling, a crafted call asks the database for the whole table.
 */
export const MAX_LIMIT = 100;

/**
 * Not imported from status-filter.tsx: that file is `use client` and pulls in
 * Button and the i18n hook, none of which belongs in a query builder that runs
 * on the server. `satisfies` keeps this honest if the union ever gains a case.
 */
const STATUSES = ["all", "Paid", "Unpaid"] as const satisfies readonly StatusFilter[];

export type ReceiptQuery = {
  sort: SortKey;
  /** Trimmed search term; empty means unfiltered. */
  q: string;
  status: StatusFilter;
  period: Period;
};

export type SearchParams = Record<string, string | string[] | undefined>;

/** Next hands back `string[]` for a repeated param; take the first. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A calendar day, or null.
 *
 * The round-trip is the point: `2026-02-31` passes a regex and passes
 * `Date.parse`, which rolls it forward to 3 March. Comparing the parsed date
 * back to the input is what rejects a day that does not exist.
 */
function day(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function periodFrom(params: SearchParams): Period {
  const days = Number(one(params.days));
  if (Number.isInteger(days) && days > 0) return { kind: "days", days };

  const from = day(one(params.from));
  const to = day(one(params.to));
  // An open-ended range is legitimate; a range with neither end is just "all".
  if (!from && !to) return { kind: "all" };
  // A backwards range would return nothing with no way to see why.
  if (from && to && from > to) return { kind: "all" };
  return { kind: "custom", from, to };
}

/**
 * Every value here came from the URL bar, so all of it is user input. A
 * hand-edited or stale link must render the default list rather than an error
 * page — hence falling back rather than throwing, everywhere.
 */
export function parseReceiptQuery(params: SearchParams): ReceiptQuery {
  const sort = one(params.sort);
  const status = one(params.status);
  return {
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? "")
      ? (sort as SortKey)
      : DEFAULT_SORT,
    q: (one(params.q) ?? "").trim(),
    status: (STATUSES as readonly string[]).includes(status ?? "")
      ? (status as StatusFilter)
      : "all",
    period: periodFrom(params),
  };
}

type Order = { column: string; ascending: boolean };

/**
 * The `order by` for a sort key, always as a *total* order.
 *
 * The trailing receipt_number is not cosmetic. Rows sharing a collection_date
 * have no defined order without it, so the database may order them one way for
 * page 1 and another for page 2 — which shows a receipt twice, or never. It is
 * omitted only when receipt_number is already the primary sort.
 */
export function orderFor(sort: SortKey): Order[] {
  const tiebreak: Order = { column: "receipt_number", ascending: false };
  switch (sort) {
    case "date-desc":
      return [{ column: "collection_date", ascending: false }, tiebreak];
    case "date-asc":
      return [{ column: "collection_date", ascending: true }, tiebreak];
    case "amount-desc":
      return [{ column: "amount", ascending: false }, tiebreak];
    case "amount-asc":
      return [{ column: "amount", ascending: true }, tiebreak];
    case "name-asc":
      return [{ column: "donor_name", ascending: true }, tiebreak];
    case "number-asc":
      return [{ column: "receipt_number", ascending: true }];
    case "number-desc":
      return [{ column: "receipt_number", ascending: false }];
  }
}

/**
 * PostgREST's `.or()` filter for a search term, or null when there is nothing
 * to search for.
 *
 * Two kinds of escaping, for two different reasons:
 *
 *  - `%` and `_` are ilike wildcards. A donor called "100%" searched
 *    unescaped matches every row instead of one.
 *  - `,` separates clauses inside `or(...)`, and `.` separates a clause's
 *    parts, so a term containing either would break out of its own clause.
 *    Wrapping the pattern in double quotes is how PostgREST takes a value
 *    containing reserved characters literally.
 */
export function searchFilter(q: string): string | null {
  const term = q.trim();
  if (!term) return null;

  const escaped = term
    // Backslash first, or it would double-escape what follows.
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/"/g, '\\"');

  const clauses = [
    `donor_name.ilike."%${escaped}%"`,
    `phone_number.ilike."%${escaped}%"`,
  ];
  // Only worth asking when the term could be a slip number; receipt_number is
  // an integer column and a non-numeric comparison is an error, not a miss.
  if (/^\d+$/.test(term)) clauses.push(`receipt_number.eq.${term}`);
  return clauses.join(",");
}

/** Bounds for a page requested by a client we do not control. */
export function clampPage(offset: unknown, limit: unknown) {
  const o = Number(offset);
  const l = Number(limit);
  return {
    offset: Number.isFinite(o) && o > 0 ? Math.floor(o) : 0,
    limit:
      Number.isFinite(l) && l >= 1
        ? Math.min(Math.floor(l), MAX_LIMIT)
        : DEFAULT_LIMIT,
  };
}

/**
 * The shape of a Supabase query builder, described structurally so this module
 * stays free of the client. Both callers are server-side — the receipts page
 * and the fetchReceipts action — and they MUST apply the same order and
 * filters, or "show more" would page through a different result than the first
 * page came from.
 */
type ReceiptFilterable<T> = {
  order(column: string, options: { ascending: boolean }): T;
  eq(column: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  or(filter: string): T;
};

/** Applies all four controls to a query. Paging is the caller's business. */
export function applyReceiptQuery<T extends ReceiptFilterable<T>>(
  builder: T,
  query: ReceiptQuery,
): T {
  let q = builder;

  for (const { column, ascending } of orderFor(query.sort)) {
    q = q.order(column, { ascending });
  }

  if (query.status !== "all") q = q.eq("payment_status", query.status);

  // rangeOf is the same function the client used to filter with, so a period
  // means exactly what it always meant. Reused rather than reimplemented.
  const { from, to } = rangeOf(query.period);
  if (from) q = q.gte("collection_date", from);
  if (to) q = q.lte("collection_date", to);

  const search = searchFilter(query.q);
  if (search) q = q.or(search);

  return q;
}
