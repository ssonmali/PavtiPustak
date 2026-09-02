import type { Receipt } from "@/lib/types";

/** How many pledges a tap on "view more" reveals. */
export const DUE_PAGE = 5;

/** Only the fields the arithmetic reads, so tests need not build whole rows. */
type Pledge = Pick<Receipt, "due_on">;

/**
 * How much of the reminder list is on screen, and how late it is.
 *
 * Pure and exported for the tests. The button's label has to promise exactly
 * what the tap delivers — `nextBatch` is what it counts, `nextShown` is where
 * it lands — and `overdueCount` describes the *whole* list, including the part
 * still hidden, because it is what makes the collapsed card ask to be opened.
 */
export function duePanelView<T extends Pledge>(
  pledges: T[],
  shown: number,
  today: string,
) {
  const visible = pledges.slice(0, shown);
  const remaining = pledges.length - visible.length;
  return {
    visible,
    remaining,
    nextBatch: Math.min(remaining, DUE_PAGE),
    nextShown: Math.min(pledges.length, shown + DUE_PAGE),
    // A pledge falling due today is not late yet, and one with no date cannot be.
    overdueCount: pledges.filter((p) => p.due_on && p.due_on < today).length,
  };
}
