import { Skeleton } from "@/components/skeleton";

/**
 * Stands in for the activity feed while its query runs.
 *
 * Shaped from activity-list.tsx rather than the generic placeholder this used
 * to share with receipts and expenses — which was a heading, a bar and six
 * rows inside one Card, and matched none of the three.
 *
 * This tab's header is the plainest of the ledgers: a heading with a volunteer
 * picker under it and no action button, because nothing here is created by
 * hand. Then three filter rows from `sm` up, collapsed into one sheet button
 * below it, then the feed grouped under a date heading per day.
 *
 * The rows are taller than a ledger's: each carries a badge, a label, the
 * changed fields and a timestamp line.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-8 w-40 sm:h-9" />
        {/* The volunteer picker, which only appears from sm. */}
        <Skeleton className="hidden h-8 w-44 sm:block" />
      </div>

      {/* Ledger, action and period rows inline from sm; one sheet button below. */}
      <div className="hidden flex-col gap-4 sm:flex">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-80 rounded-lg" />
      </div>
      <div className="sm:hidden">
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* One day's worth: a date heading, then its entries. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
