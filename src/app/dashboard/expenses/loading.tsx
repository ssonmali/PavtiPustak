import { Skeleton } from "@/components/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
 * The category breakdown IS reserved, unlike DuePanel on the overview. It
 * renders null only when the period holds no expenses at all
 * (category-breakdown.tsx) — and in that case the list beneath it is empty
 * too, so the skeleton is over-reserved either way. Every other time, which
 * is the normal one, the card is there and the whole ledger below would drop
 * by its height. Four bars rather than eight: a mandal spends across a handful
 * of categories, and under-reserving by one row shifts less than over-reserving
 * by four.
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

      {/* What the money went on: a titled card with one bar per category. */}
      <Card className="card-elevated">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl sm:h-12" />
        ))}
      </div>
    </div>
  );
}
