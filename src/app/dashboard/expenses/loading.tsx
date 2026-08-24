import { Skeleton } from "@/components/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Not just a nicer wait: a dynamic route with no loading boundary is not
 * prefetched at all, so without this the Expenses tab was the one that always
 * felt slow — the fetch only started on the tap.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
