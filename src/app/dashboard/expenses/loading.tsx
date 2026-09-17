import { Skeleton } from "@/components/skeleton";

/**
 * Stands in for the expenses ledger while its query runs.
 *
 * Not just a nicer wait: a dynamic route with no loading boundary is not
 * prefetched at all, so without this the Expenses tab was the one that always
 * felt slow — the fetch only started on the tap.
 *
 * Shaped from expenses-view.tsx rather than the generic placeholder this used
 * to share with receipts and activity. That one was a heading, a bar and six
 * rows in a Card — much shorter than the real page, so everything below the
 * fold moved on arrival.
 *
 * NOT mirrored: CategoryBreakdown. It renders null with no rows
 * (category-breakdown.tsx), so reserving its height would trade one shift for
 * another on a mandal that has not recorded a spend yet.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-8 w-36 sm:h-9" />
            {/* The spent total and its count. */}
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
        </div>

        {/* The status chips inline from sm, one filter button below it. */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="hidden h-9 w-28 rounded-full sm:block" />
          <Skeleton className="hidden h-9 w-28 rounded-full sm:block" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl sm:h-12" />
        ))}
      </div>
    </div>
  );
}
