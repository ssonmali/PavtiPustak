import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The two halves of a part-paid row, as a matched pair of pills.
 *
 * They are deliberately the same shape and size, differing only in hue and
 * glyph: money that has changed hands, and money that has not. A figure set in
 * plain text beside a pill reads as the more important of the two, which is
 * wrong — on a split row neither half is.
 *
 * Shared by both ledgers. Contributions coming in and bills going out show the
 * identical split, and two near-copies of this would drift.
 */

/** Money already handed over. */
export function PaidPill({
  label,
  title,
}: {
  label: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-positive/40 bg-positive/12 px-2 py-0.5 text-xs font-medium text-positive-ink"
    >
      <Check aria-hidden className="size-3" />
      {label}
    </span>
  );
}

/**
 * Money still owed. Overdue turns it red — an amount that reads as settled
 * when it has not been is the one error worth being loud about.
 */
export function UnpaidBadge({
  dueOn,
  today,
  label,
  title,
}: {
  dueOn: string | null;
  today: string;
  label: string;
  title: string;
}) {
  const overdue = Boolean(dueOn) && dueOn! < today;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        overdue
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-pending/45 bg-pending/15 text-foreground",
      )}
    >
      <Clock aria-hidden className="size-3" />
      {label}
    </span>
  );
}
