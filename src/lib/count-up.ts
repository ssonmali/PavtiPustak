/**
 * The arithmetic behind a figure that moves when it changes.
 *
 * Pure and separate from the component for the usual reason: this is the part
 * that can be wrong in ways nobody sees on screen. A count-up that overshoots,
 * or that lands on 1,999 instead of 2,000, is a ledger showing the wrong
 * number — briefly, but a volunteer reading a total does not know it is still
 * moving. The tests pin the landing exactly.
 */

/**
 * Decelerating ease. Fast at the start so the change is noticed, slow at the
 * end so the final digits are readable rather than a blur.
 */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The value to show `elapsed` ms into a change from `from` to `to`.
 *
 * Rounded to whole rupees, which is what the ledger deals in — paise would
 * make the last frames flicker through digits that mean nothing.
 *
 * Guarantees, and each is a test:
 *  - at elapsed <= 0 it is exactly `from`
 *  - at elapsed >= duration it is exactly `to`, never a rounding of it
 *  - it is monotonic between them, so the figure never ticks backwards
 */
export function valueAt(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
): number {
  if (duration <= 0 || elapsed >= duration) return to;
  if (elapsed <= 0) return from;
  return Math.round(from + (to - from) * easeOutCubic(elapsed / duration));
}

/**
 * How long a change from `from` to `to` should take.
 *
 * Not a constant: a receipt of ₹101 landing on a ₹40,000 total is a small
 * change and should be a glance, while the total appearing for the first time
 * after a filter clears is a big one and deserves the full sweep. Scaled by
 * the RELATIVE size of the change, because ₹500 means something different on
 * a ₹1,000 total than on a ₹100,000 one.
 *
 * Bounded at both ends: below ~200ms a count-up is a flicker rather than a
 * movement, and above 900ms it is still going when the volunteer has moved on.
 */
export function durationFor(from: number, to: number): number {
  const span = Math.abs(to - from);
  if (span === 0) return 0;
  const scale = Math.max(Math.abs(from), Math.abs(to));
  const ratio = scale === 0 ? 1 : Math.min(span / scale, 1);
  return Math.round(200 + 700 * ratio);
}
