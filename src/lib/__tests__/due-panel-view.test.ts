import { describe, expect, it } from "vitest";
import { DUE_PAGE, duePanelView } from "@/app/dashboard/due-view";
import type { Receipt } from "@/lib/types";

/** Only the fields the view arithmetic reads. */
type Pledge = Pick<Receipt, "id" | "due_on">;

const TODAY = "2026-09-02";

const pledge = (id: string, due_on: string | null): Pledge => ({ id, due_on });

/** n pledges, all due today, so slicing tests are not about overdue-ness. */
const many = (n: number): Pledge[] =>
  Array.from({ length: n }, (_, i) => pledge(`p${i}`, TODAY));

describe("duePanelView — how much of the list is on screen", () => {
  it("shows only the first page when there is more than a page", () => {
    const view = duePanelView(many(8), DUE_PAGE, TODAY);
    expect(view.visible).toHaveLength(DUE_PAGE);
    expect(view.visible[0]!.id).toBe("p0");
  });

  it("shows everything when the list is shorter than a page", () => {
    const view = duePanelView(many(3), DUE_PAGE, TODAY);
    expect(view.visible).toHaveLength(3);
    expect(view.remaining).toBe(0);
  });

  it("counts what is still hidden", () => {
    expect(duePanelView(many(8), DUE_PAGE, TODAY).remaining).toBe(3);
  });
});

describe("duePanelView — the 'view more' button", () => {
  /**
   * The label has to promise what the tap delivers. Saying "view 12 more" and
   * then revealing five is the off-by-one that ships unnoticed, so nextBatch is
   * what the button counts and nextShown is where it lands.
   */
  it("offers a full page while a full page is left", () => {
    expect(duePanelView(many(20), DUE_PAGE, TODAY).nextBatch).toBe(DUE_PAGE);
  });

  it("offers only what is left at the tail", () => {
    const view = duePanelView(many(7), DUE_PAGE, TODAY);
    expect(view.nextBatch).toBe(2);
    expect(view.nextShown).toBe(7);
  });

  it("never counts past the end of the list", () => {
    const view = duePanelView(many(4), 99, TODAY);
    expect(view.visible).toHaveLength(4);
    expect(view.remaining).toBe(0);
    expect(view.nextBatch).toBe(0);
    expect(view.nextShown).toBe(4);
  });
});

describe("duePanelView — the overdue hint", () => {
  /**
   * This number is the whole reason the collapsed card blinks. A pledge due
   * today is not late, and one with no due date cannot be.
   */
  it("counts a pledge whose date has passed", () => {
    const view = duePanelView(
      [pledge("a", "2026-08-28"), pledge("b", TODAY)],
      DUE_PAGE,
      TODAY,
    );
    expect(view.overdueCount).toBe(1);
  });

  it("does not count one that falls due today", () => {
    expect(duePanelView([pledge("a", TODAY)], DUE_PAGE, TODAY).overdueCount).toBe(0);
  });

  it("does not count one with no due date at all", () => {
    expect(duePanelView([pledge("a", null)], DUE_PAGE, TODAY).overdueCount).toBe(0);
  });

  it("counts pledges hidden below the fold, not just the visible ones", () => {
    // The hint exists to describe the whole list while it is collapsed.
    const late = Array.from({ length: 8 }, (_, i) => pledge(`p${i}`, "2026-08-01"));
    expect(duePanelView(late, DUE_PAGE, TODAY).overdueCount).toBe(8);
  });
});
