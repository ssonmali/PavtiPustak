import { Skeleton } from "@/components/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Stands in for Overview while its queries run — and has to stand in at the
 * RIGHT HEIGHT, which is the whole job.
 *
 * Field data put this page's CLS at 0.38 (anything over 0.25 is "poor"). The
 * previous skeleton was a heading, a four-card grid and one h-40 block, in that
 * order. The real page is a heading, then the hero balance card, then the grid,
 * then the donation box — so every section landed somewhere the placeholder had
 * not reserved, and the page jumped as it swapped in.
 *
 * Mirrored deliberately, and in the real order:
 *   - the header row (title + subtitle)
 *   - the hero Card: CardHeader (label, big figure, sub-line) + a CardContent
 *     row of figures
 *   - the 2x2 / 1x4 stat grid
 *   - the donation box card
 *
 * NOT mirrored: DuePanel. It renders null when nothing is due (due-panel.tsx),
 * so reserving space for it would trade one shift for another on every mandal
 * with no pledges outstanding.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header: h1 is text-2xl/3xl, with a muted subtitle under it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto flex flex-col gap-2">
          <Skeleton className="h-8 w-48 sm:h-9" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* The hero balance card. */}
      <Card className="card-elevated accent-top">
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          {/* The collected / spent figures, which wrap on a phone. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-28" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* The donation box, which always renders even when empty. */}
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
