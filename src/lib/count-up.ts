/**
 * The arithmetic behind a figure that moves when it changes.
 *
 * Pure and tested because it can be wrong invisibly: a count-up that lands on
 * 1,999 instead of 2,000 is a ledger showing the wrong number, and a volunteer
 * reading a total does not know it is still moving.
 */

/** Decelerating: noticed at the start, readable at the end. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The value to show `elapsed` ms into a change from `from` to `to`.
 *
 * Whole rupees — paise would flicker through digits that mean nothing. Each
 * guarantee has a test: exactly `from` at elapsed <= 0, exactly `to` at
 * elapsed >= duration, and monotonic between, so it never ticks backwards.
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
 * How long a change should take, scaled by its RELATIVE size — ₹500 means
 * something different on a ₹1,000 total than on a ₹100,000 one. Bounded: under
 * 200ms is a flicker, over 900ms is still going once attention has moved on.
 */
export function durationFor(from: number, to: number): number {
  const span = Math.abs(to - from);
  if (span === 0) return 0;
  const scale = Math.max(Math.abs(from), Math.abs(to));
  const ratio = scale === 0 ? 1 : Math.min(span / scale, 1);
  return Math.round(200 + 700 * ratio);
}
