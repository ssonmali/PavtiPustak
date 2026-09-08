"use client";

import * as React from "react";

/**
 * A class name present for one animation when `value` changes.
 *
 * For the count badges — the bell's due-today, the unpaid tally on the chips.
 * Those change underneath a volunteer when a colleague records a payment, and
 * a digit that simply differs is a change nobody sees.
 *
 * ONE pulse, never a loop: a badge still blinking while someone works down the
 * list nags rather than informs. Silent on first paint, too — a page load is
 * not a change, and every badge beating on arrival is a slot machine.
 */
export function usePulseOnChange(value: number | string): string {
  const [pulsing, setPulsing] = React.useState(false);

  // Seeded WITH the initial value, not undefined — that is what makes the
  // first paint silent without a separate "have we mounted" flag.
  const previous = React.useRef(value);

  React.useEffect(() => {
    if (value === previous.current) return;
    previous.current = value;
    setPulsing(true);
    // Past the 420ms animation. A timer rather than onAnimationEnd, which does
    // not fire if the element is hidden or the tab is backgrounded mid-pulse —
    // and a badge stuck with the class replays the beat on every re-render.
    const timer = setTimeout(() => setPulsing(false), 500);
    return () => clearTimeout(timer);
  }, [value]);

  return pulsing ? "pulse-once" : "";
}
