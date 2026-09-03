import { describe, expect, it } from "vitest";
import { shouldAdoptTerm } from "@/app/dashboard/search-draft";

/**
 * The sequences below are written as the field actually behaves, because the
 * bug this guards was a sequence and not a value: every individual call looked
 * right. The receipts search pushes its term debounced and the navigation is a
 * server round trip, so the field can receive its own term back while the
 * volunteer is mid-edit.
 */
describe("shouldAdoptTerm", () => {
  it("adopts a term when nothing has been typed since", () => {
    // The box and the URL agree at "", then the URL changes elsewhere.
    expect(shouldAdoptTerm("sanket", "", "")).toBe(true);
  });

  it("ignores a term identical to the one already observed", () => {
    expect(shouldAdoptTerm("sanket", "sanket", "sanke")).toBe(false);
  });

  it("does not clobber a draft the volunteer is still editing", () => {
    // The reported bug: "sanket" was pushed, the volunteer backspaced to
    // "sanke", then the echo of "sanket" arrived. Adopting it here is what
    // put the deleted letters back.
    expect(shouldAdoptTerm("sanket", "", "sanke")).toBe(false);
  });

  it("treats trailing whitespace as agreement, not divergence", () => {
    // The pushed term is trimmed, so "sanket " and "sanket" are one search
    // and the box has effectively not moved.
    expect(shouldAdoptTerm("other", "sanket", "sanket ")).toBe(true);
  });

  describe("the reported sequence, step by step", () => {
    it("keeps the backspaced value and converges on it", () => {
      // observed/draft as the component holds them; each step is one event.
      let observed = "";
      let draft = "";

      // 1. Typing. No prop has arrived yet.
      draft = "sanket";
      expect(shouldAdoptTerm(observed, observed, draft)).toBe(false);

      // 2. The debounce fires and pushes "sanket". Still no prop.

      // 3. The volunteer backspaces while the navigation is in flight.
      draft = "sanke";

      // 4. The echo of the volunteer's OWN push arrives. This is the moment
      //    the letters used to come back.
      expect(shouldAdoptTerm("sanket", observed, draft)).toBe(false);
      observed = "sanket";
      expect(draft).toBe("sanke");

      // 5. The debounce pushes "sanke"; its echo must also be ignored, and
      //    is harmless either way since the two now agree.
      expect(shouldAdoptTerm("sanke", observed, draft)).toBe(false);
      observed = "sanke";

      // 6. Settled: the box and the URL agree, so an external change is
      //    adopted again — the back button still works.
      expect(shouldAdoptTerm("older term", observed, draft)).toBe(true);
    });

    it("still follows the back button once typing has settled", () => {
      // Box and URL agreed at "sanket"; history moves to an earlier term.
      expect(shouldAdoptTerm("", "sanket", "sanket")).toBe(true);
    });
  });
});
