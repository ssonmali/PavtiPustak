"use client";

import * as React from "react";

import { durationFor, valueAt } from "@/lib/count-up";
import { formatAmount } from "@/lib/receipt-utils";

/**
 * A money figure that counts to its new value instead of swapping to it.
 *
 * The reason is not decoration. This is a ledger, and every total on screen is
 * shared: you save a receipt and the day's collection changes, a colleague
 * saves one on their phone and realtime changes it under you. Before this, the
 * number simply *was* different — nothing connected the act to the figure, and
 * a change that arrived from another device had no way of being noticed at all.
 * Movement is what says "this just changed", and it says it without a badge,
 * a toast, or anything else that has to be dismissed.
 *
 * Three things it deliberately does NOT do:
 *
 *  1. It does not animate on first paint. A page load is not a change, and a
 *     screenful of figures all counting up on arrival is a slot machine. The
 *     first value is rendered as itself.
 *  2. It does not animate when the value is unchanged. The realtime safety net
 *     calls router.refresh() on a timer, which re-renders every one of these
 *     with the same number; durationFor returns 0 for that and nothing runs.
 *  3. It does not animate under prefers-reduced-motion. The figure is the
 *     content, so it still updates — it just arrives rather than travels.
 *
 * Server-rendered as the real value, so the number is correct with no
 * JavaScript and correct in the HTML a crawler or a print stylesheet sees.
 */
export function AnimatedAmount({
  value,
  className,
}: {
  /** The figure in rupees. */
  value: number;
  className?: string;
}) {
  const [shown, setShown] = React.useState(value);

  /*
   * The value the last animation was aimed at.
   *
   * Held in a ref rather than compared against `shown`, because `shown` is
   * mid-flight for most of the animation: comparing against it would restart
   * the count on every frame it triggered a render. This is the target, and it
   * only moves when the prop does.
   */
  const target = React.useRef(value);

  React.useEffect(() => {
    if (value === target.current) return;

    const from = target.current;
    target.current = value;

    // Reduced motion, and the degenerate no-change case, both land here.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : durationFor(from, value);
    if (duration === 0) {
      setShown(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = valueAt(from, value, now - start, duration);
      setShown(next);
      if (next !== value) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    /*
     * Cancelled on the way out, and the ref is already at `value`, so a second
     * change arriving mid-flight starts from wherever the eye last saw rather
     * than from the old total. Without the cancel, two overlapping rAF loops
     * would fight over setShown and the figure would jitter between them.
     */
    return () => cancelAnimationFrame(raf);
  }, [value]);

  /*
   * tabular-nums is not optional here. In a proportional face the digits have
   * different widths, so a counting figure changes width on almost every
   * frame — which shoves whatever sits beside it back and forth for the whole
   * animation. The app already sets tabular figures globally for money; this
   * restates it because losing it here is a visible bug rather than a subtle
   * one.
   */
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatAmount(shown)}
    </span>
  );
}
