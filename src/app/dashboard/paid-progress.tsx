import { formatAmount } from "@/lib/receipt-utils";
import { cn } from "@/lib/utils";

/**
 * How much of an agreed amount has changed hands, as a bar.
 *
 * Two figures and a badge tell a volunteer that ₹3,000 of ₹10,000 has arrived,
 * but only after reading them. A bar says "about a third" before it is read,
 * which is what someone scanning a list actually wants — and it is the same
 * idiom the volunteer shares on the overview already use, so it is one thing to
 * learn rather than two.
 *
 * Decorative on purpose: aria-hidden, because the received amount and the
 * remainder are already beside it as text. Announcing it again would read the
 * same fact twice, and the colour is never the only carrier of it.
 */
export function PaidProgress({
  paid,
  total,
  className,
}: {
  paid: number;
  total: number;
  className?: string;
}) {
  // Guarded rather than trusted: a zero total would divide to Infinity, and a
  // paid_amount above the total is rejected by the database but must not draw
  // past the end of the track if a stale row ever reaches the client.
  const share = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;

  return (
    <span
      aria-hidden
      title={`${formatAmount(paid)} / ${formatAmount(total)}`}
      className={cn(
        // The track is what is still owed, the fill is what arrived — the same
        // two hues the pending and positive figures wear everywhere else.
        "block h-1.5 overflow-hidden rounded-full bg-pending/30",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-positive"
        // A sliver rather than nothing at 1%: the bar exists to say "some of it
        // has arrived", and rounding that away contradicts the badge beside it.
        style={{ width: `${Math.max(share, 6)}%` }}
      />
    </span>
  );
}
