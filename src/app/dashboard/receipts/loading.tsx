import { Skeleton } from "@/components/skeleton";

/**
 * Stands in for the receipts ledger while its query runs.
 *
 * The shape matters more than the prettiness. This was the same generic
 * placeholder the expenses and activity tabs used — a heading, a bar and six
 * rows inside one Card, about 450px tall against a real page nearer 780 on a
 * phone. Everything below the fold moved when the real page arrived, which is
 * what CLS measures.
 *
 * Mirrored from receipts-view.tsx: the heading and its money sub-line with the
 * New button beside it, the search field, the filter row, then the list. The
 * rows are cards below `sm` and a table above it — the card height is what a
 * phone sees, and phones are where the field data is poor.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-8 w-44 sm:h-9" />
            {/* The collected total and receipt count. */}
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
        </div>

        {/* The period presets, desktop only — below `sm` they are in the
            sheet that sits beside the search box. */}
        <Skeleton className="hidden h-9 w-72 rounded-lg sm:block" />
      </div>

      {/* The status chips, desktop only for the same reason. */}
      <Skeleton className="hidden h-9 w-64 rounded-lg sm:block" />

      {/* Search, the filter button and sort share ONE row — receipts-table.tsx
          renders them together, so a phone sees a single 36px line here and
          not the two the earlier version of this file reserved. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 min-w-0 flex-1" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full sm:hidden" />
        <Skeleton className="hidden h-9 w-24 shrink-0 rounded-full sm:block" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl sm:h-12" />
        ))}
      </div>
    </div>
  );
}
