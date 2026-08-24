import { describe, expect, it } from "vitest";
import {
  isFullyPaid,
  isPartPaid,
  outstanding,
  received,
} from "@/lib/receipt-utils";
import type { Receipt } from "@/lib/types";

type Money = Pick<Receipt, "amount" | "paid_amount" | "payment_status">;

const settled: Money = { amount: 1000, paid_amount: null, payment_status: "Paid" };
const untouched: Money = { amount: 1000, paid_amount: null, payment_status: "Unpaid" };
const half: Money = { amount: 1000, paid_amount: 500, payment_status: "Unpaid" };

describe("received / outstanding", () => {
  it("reads a settled receipt as fully in the box", () => {
    expect(received(settled)).toBe(1000);
    expect(outstanding(settled)).toBe(0);
  });

  it("reads an untouched pledge as nothing in the box", () => {
    expect(received(untouched)).toBe(0);
    expect(outstanding(untouched)).toBe(1000);
  });

  it("splits a part-paid contribution", () => {
    expect(received(half)).toBe(500);
    expect(outstanding(half)).toBe(500);
  });

  /**
   * The invariant the whole feature rests on. If it ever fails, the collected
   * total and the expected total either double-count the same rupees or lose
   * them — the Overview's Estimated tile adds the two together.
   */
  it("always splits the agreed amount exactly, never double-counting", () => {
    const rows: Money[] = [
      settled,
      untouched,
      half,
      { amount: 2500, paid_amount: 1, payment_status: "Unpaid" },
      { amount: 2500, paid_amount: 2499, payment_status: "Unpaid" },
      { amount: 750.5, paid_amount: 250.25, payment_status: "Unpaid" },
      { amount: 1000, paid_amount: 0, payment_status: "Unpaid" },
    ];
    for (const r of rows) {
      expect(received(r) + outstanding(r), JSON.stringify(r)).toBe(
        Number(r.amount),
      );
    }
    // And in aggregate, which is how the tiles actually use it.
    const agreed = rows.reduce((n, r) => n + Number(r.amount), 0);
    const collected = rows.reduce((n, r) => n + received(r), 0);
    const expected = rows.reduce((n, r) => n + outstanding(r), 0);
    expect(collected + expected).toBe(agreed);
  });

  it("ignores a stale paid_amount on a settled row rather than adding it", () => {
    // The DB constraint forbids this pairing, but the helper must not
    // double-count if a row ever reaches the client in that shape.
    const odd: Money = { amount: 1000, paid_amount: 400, payment_status: "Paid" };
    expect(received(odd)).toBe(1000);
    expect(outstanding(odd)).toBe(0);
  });

  it("never reports a negative remainder", () => {
    const over: Money = { amount: 1000, paid_amount: 1200, payment_status: "Unpaid" };
    expect(outstanding(over)).toBe(0);
  });
});

describe("isPartPaid / isFullyPaid", () => {
  it("recognises the three states", () => {
    expect(isPartPaid(half)).toBe(true);
    expect(isPartPaid(settled)).toBe(false);
    expect(isPartPaid(untouched)).toBe(false);
  });

  it("treats a zero recorded payment as not yet part-paid", () => {
    // Recording ₹0 is not a payment; the badge should still read as a pledge.
    expect(isPartPaid({ amount: 1000, paid_amount: 0, payment_status: "Unpaid" })).toBe(
      false,
    );
  });

  /** This is what gates the share button, so it is worth being explicit. */
  it("only calls a contribution sendable once nothing is outstanding", () => {
    expect(isFullyPaid(settled)).toBe(true);
    expect(isFullyPaid(half)).toBe(false);
    expect(isFullyPaid(untouched)).toBe(false);
    // Every instalment in, but the row not yet flipped to Paid: the money is
    // all there, so a receipt is legitimate.
    expect(
      isFullyPaid({ amount: 1000, paid_amount: 1000, payment_status: "Unpaid" }),
    ).toBe(true);
  });
});
