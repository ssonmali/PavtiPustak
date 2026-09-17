import { Skeleton } from "@/components/skeleton";

/**
 * Stands in for the printable report while its queries run.
 *
 * The old version was a 36px heading over a flat 256px block, which matched
 * neither half of the page: the toolbar is two rows (print and export buttons,
 * then the from/to/sort form) and the paper below it is a full sheet, far
 * taller than 256px once it holds a table.
 *
 * `max-w-3xl` and the same gap as the real page, so the column does not
 * change width as the content lands — a horizontal shift counts too.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* Print, and the export menu. */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        {/* From, To and the sort control, which wrap on a phone. */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* The sheet itself: a centred heading, then the table. */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-col items-center gap-2 pb-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
