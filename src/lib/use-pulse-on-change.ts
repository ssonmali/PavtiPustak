"use client";

import * as React from "react";

/**
 * A class name that is present for one animation when `value` changes.
 *
 * For the count badges — the bell's pledges-due-today, the unpaid tally on the
 * status chips. Those numbers change underneath a volunteer: a colleague logs
 * a payment and the tally drops, a pledge falls due and the bell's count goes
 * up. Before this the digit simply differed, which is a change nobody sees.
 *
 * ONE pulse, never a loop, and that is a rule this app has already written
 * down: globals.css turned down a permanently pulsing overdue badge on the
 * grounds that a badge still blinking while a volunteer works down the list is
 * nagging rather than informing. A single beat at the moment of change is the
 * informing half of that without the nagging half.
 *
 * Silent on first paint. A page load is not a change, and every badge on
 * screen beating on arrival would be a slot machine — the same reasoning as
 * AnimatedAmount, and the same trap.
 */
export function usePulseOnChange(value: number | string): string {
  const [pulsing, setPulsing] = React.useState(false);

  /*
   * The last value seen, held in a ref so that reading it does not itself
   * cause a render. Seeded WITH the initial value rather than with undefined:
   * that is what makes the first paint silent, and doing it here rather than
   * with a separate "have we mounted" flag keeps it to one piece of state.
   */
  const previous = React.useRef(value);

  React.useEffect(() => {
    if (value === previous.current) return;
    previous.current = value;
    setPulsing(true);
    // Comfortably past the 420ms animation. A timer rather than
    // onAnimationEnd, because that event does not fire if the element is
    // hidden or the tab is backgrounded mid-pulse — and a badge stuck with
    // the class would replay the beat on every later re-render.
    const timer = setTimeout(() => setPulsing(false), 500);
    return () => clearTimeout(timer);
  }, [value]);

  return pulsing ? "pulse-once" : "";
}
