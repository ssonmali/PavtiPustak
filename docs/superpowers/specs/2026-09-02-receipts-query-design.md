# Receipts list: sort, search and filter over the whole ledger

**Date:** 2026-09-02
**Status:** awaiting review

## The problem

The receipts page has four controls — search, sort, status, period — that all
appear to act on the ledger and all act on a 50-row window.

The server sends the newest 50 rows (`receipts/page.tsx`, `.order('collection_date',
desc).order('receipt_number', desc).range(0, 49)`). Every control then runs in
the browser over those rows:

| Control | Where it runs | What it actually does |
|---|---|---|
| Search | `receipts-table.tsx:227` | matches within the loaded rows |
| Sort | `receipts-table.tsx:237` | orders the loaded rows |
| Period | `receipts-view.tsx:79` | `filterByPeriod` over loaded rows |
| Status | `receipts-view.tsx:84` | `filterByStatus` over loaded rows |

Reported symptom: sorting receipt numbers ascending starts at #47. With 96
receipts, rows 47–96 *are* the newest 50, so #47 is the smallest number present
in memory. Tapping "show more" fetches older rows and #1 finally appears at the
top. The list was never wrong about what it had; it was wrong about what it
implied it had.

Two consequences beyond the report:

- **Sort and search reset on navigation.** They are `useState` in the table
  (`:157-158`), and `period`/`status` are `useState` in the view (`:55-56`).
  Switching tabs unmounts the component and the state with it.
- **Pagination is already disabled under a filter.** `receipts-view.tsx:193`
  passes `total={online && status === "all" ? total : undefined}`, so "show
  more" disappears when a status filter is on. Filters and paging do not
  compose today, and this hid that rather than resolving it.

## What this changes

Every control becomes part of one database query. The browser stops reordering
and refiltering rows; the order it renders is the order the server returned.

### The URL is the state

```
/dashboard/receipts?sort=number-asc&q=ramesh&status=Unpaid&days=7
/dashboard/receipts?sort=amount-desc&from=2026-08-01&to=2026-08-31
```

This is what fixes the reset-on-navigation symptom, and it is why the URL is
the mechanism rather than lifting state into a context: a Server Component can
read `searchParams` and build the query directly, so the first paint is already
correct and sorted. No client round trip on load, and no flash of
newest-first before the real order arrives.

It also makes a filtered view shareable and back/forward navigable, which is a
side benefit rather than the goal.

Defaults are absent params: no `sort` means `date-desc`, no `status` means
`all`, no period means all time. So the plain URL keeps working unchanged.

### One query, built from the URL

The server component reads the params, validates them, and issues a single
query with `{ count: 'exact' }`:

- **sort** → `.order(column, { ascending })`, mapped from the `SortKey`. Always
  followed by `.order('receipt_number', desc)` as a tiebreaker, or rows with
  equal dates or amounts can shuffle between pages and appear twice.
- **status** → `.eq('payment_status', status)` unless `all`.
- **period** → `rangeOf(period)` already returns `{ from, to }` as `YYYY-MM-DD`,
  so this is `.gte('collection_date', from)` / `.lte('collection_date', to)`.
  That function is pure and already tested; it is reused, not reimplemented.
- **search** → `.or()` across `donor_name` ilike, `phone_number` ilike, and
  `receipt_number` eq when the term is numeric.

`fetchReceipts` takes the same parameters, so "show more" pages through the
*filtered, sorted* result. That removes the `status === "all"` condition on
`total`: paging composes with filters because the server is doing both.

### Offline: the controls are disabled

Chosen deliberately. Server-side sort and search cannot run with no signal,
and the alternative — running them against the IndexedDB cache — returns
results that are silently incomplete, because the cache holds what this phone
happened to fetch. A volunteer reading a total needs to trust it.

So with no connection: the four controls are disabled with a "needs a
connection" hint, and the list shows the cached copy in its cached order
(newest first). `OfflineBadge` already communicates the state; this adds the
reason the controls are inert.

This is a real loss — looking up a pledge at a doorstep on one bar is exactly
when search is wanted. Recorded here so the tradeoff is a decision rather than
an oversight. Caching the full ledger would remove it, at the cost of a growing
per-device sync; that is a separate piece of work, not this one.

## Components

**`src/app/dashboard/receipts-query.ts`** (new, pure, tested)

The parsing and mapping, with no React and no Supabase in it, so it can be
tested directly:

- `parseReceiptQuery(params)` → `{ sort, q, status, period }`. Paging is not a
  URL concern — the URL always describes the first page and `fetchReceipts`
  carries the offset — so `clampPage` below owns that separately.
  Unknown or malformed values fall back to defaults rather than throwing: a
  hand-edited `?sort=garbage` must render the default list, not an error page.
- `orderFor(sort)` → `[{ column, ascending }, …]` including the tiebreaker.
- `searchFilter(q)` → the `.or()` string, with `%` and `_` escaped so a donor
  named "100%" is a search term and not a wildcard.
- `clampPage(offset, limit)` → bounds. `fetchReceipts` is a server action and
  therefore a public endpoint; today `offset` and `limit` go unvalidated into
  `.range()`, so a crafted call can ask for a million rows. Fixing that here
  also closes a finding from the earlier security review.

**`receipts/page.tsx`** — reads `searchParams`, calls `parseReceiptQuery`,
issues the one query, passes rows plus the parsed query down.

**`receipts-view.tsx`** — `period` and `status` stop being `useState` and become
props read from the URL; changing one calls `router.replace`.

Only the **receipt list** stops being filtered client-side. `filterByPeriod` is
called four times in this file and two of those must stay: `:98` filters the
`daily` totals and `:111` filters the `unpaid` rows, both feeding the collected
and due figures in the header. Those arrays are not the paginated list — they
come from `receipt_daily_totals` and a separate 1000-row query — so filtering
them in the browser is correct. Removing those two calls along with the other
two would silently break the header totals, which is the likeliest way to get
this change wrong.

**`receipts-table.tsx`** — `sort` and `query` likewise. The `filtered` memo
(`:225-243`) goes away: online the server's order is rendered as-is, and offline
the controls are disabled so there is nothing to apply. `sortRows` itself is
untouched and stays exported — `expenses-view.tsx:135` and `report/page.tsx:85`
both use it, correctly, and this work must not disturb them.

**`actions/receipts.ts`** — `fetchReceipts` accepts the query, validates via
`clampPage`, applies the same order and filters.

### Search input handling

The text field keeps local state for what is typed, and pushes to the URL
debounced at ~300ms with `router.replace`. Without the debounce every keystroke
is a request and a history entry; `replace` rather than `push` keeps the back
button meaning "the previous page", not "the previous letter".

### Tail invalidation

`pageKey` (`:164`) is `${receipts.length}:${receipts[0]?.id}`, so a new server
page usually drops appended rows. Two different queries could coincidentally
share a first row and a length, which would let pages of different orderings
mix. The parsed query gets folded into the key so it invalidates on intent
rather than on coincidence.

## Testing

TDD, and the pure module is where the real coverage goes:

- `parseReceiptQuery`: defaults for absent params; junk values rejected to
  defaults; a custom range with `from` after `to`; a non-existent status.
- `orderFor`: every `SortKey` maps to a column and direction, and every result
  carries the tiebreaker.
- `searchFilter`: `%` and `_` escaped; a numeric term also matches
  `receipt_number`; an empty term produces no filter.
- `clampPage`: negative offset, absurd limit, non-integers.

Existing `sort-rows` and `period` tests keep passing unchanged — neither
function's behaviour changes, only where it is called from.

Not unit-testable here: this repo's vitest is `environment: "node"` with
`include: ["src/**/*.test.ts"]`, so no component or URL-integration tests. The
wiring is verified by hand against the running app, and the four checks below
are what to walk through.

## Verification

Against real data, online:

1. Sort ascending by number → first row is #1, not #47.
2. Filter Unpaid → "show more" is still offered, and paging stays within unpaid.
3. Search a donor whose receipt is older than the newest 50 → it is found.
4. Switch to another tab and back → sort, search and filters are still applied.
5. Turn off the network → the four controls disable, the cached list still
   renders.

## Out of scope

- Caching the full ledger for offline parity.
- Indexes for sorting by `donor_name` or `amount`; there are none, and at a
  mandal's scale a sort over a few thousand rows is single-digit milliseconds.
  Worth revisiting only if a season's ledger reaches six figures.
- The doubled desktop/mobile row render and the realtime full-payload refetch.
  Both are known, both are separate.

**Expenses and the report are not affected, and should not be touched.** Both
fetch up to `MAX_ROWS = 1000` in one query and show a truncation notice when
they hit it (`expenses/page.tsx:21`, `report/page.tsx:59`). Sorting and
filtering in the browser is correct there, because the browser has the whole
set and the page says so when it does not. The receipts list is the only
paginated one, which is why it is the only one that lies.
