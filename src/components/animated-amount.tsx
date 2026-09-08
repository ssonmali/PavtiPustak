"use client";

import * as React from "react";

import { durationFor, valueAt } from "@/lib/count-up";
import { formatAmount } from "@/lib/receipt-utils";

/**
 * A money figure that counts to its new value instead of swapping to it.
 *
 * Not decoration: every total here is shared, so it changes when you save a
 * receipt and when a colleague saves one on their phone. Movement is what says
 * "this just changed", without a badge or a toast to dismiss.
 *
 * Three things it does NOT do: animate on first paint (a page load is not a
 * change, and a screenful of counting figures is a slot machine); animate when
 * the value is unchanged (the realtime poll re-renders these with the same
 * number, and durationFor returns 0); or animate under prefers-reduced-motion,
 * where the figure still updates but arrives rather than travels.
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

  // The value the last animation aimed at. A ref, not `shown`, which is
  // mid-flight for most of the animation and would restart the count each frame.
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

    // Without this, two overlapping rAF loops fight over setShown and the
    // figure jitters between them.
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // tabular-nums is not optional: proportional digits differ in width, so a
  // counting figure would shove whatever sits beside it back and forth.
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatAmount(shown)}
    </span>
  );
}
