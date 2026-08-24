import { describe, expect, it } from "vitest";
import { splitLedger } from "@/app/dashboard/report/split-ledger";
import { outstanding, received, type Money } from "@/lib/receipt-utils";

const settled: Money = { amount: 1000, paid_amount: null, payment_status: "Paid" };
const pledged: Money = { amount: 2000, paid_amount: null, payment_status: "Unpaid" };
const half: Money = { amount: 1000, paid_amount: 400, payment_status: "Unpaid" };

describe("splitLedger", () => {
  it("puts a settled row on the received side only", () => {
    const { settled: paid, open } = splitLedger([settled]);
    expect(paid).toHaveLength(1);
    expect(open).toHaveLength(0);
  });

  it("puts an untouched pledge on the owed side only", () => {
    const { settled: paid, open } = splitLedger([pledged]);
    expect(paid).toHaveLength(0);
    expect(open).toHaveLength(1);
  });

  it("puts a part-paid row on both sides", () => {
    const { settled: paid, open } = splitLedger([half]);
    expect(paid).toHaveLength(1);
    expect(open).toHaveLength(1);
  });

  /**
   * The reason the feature exists: the two printed section footers must add up
   * to the agreed total in the summary above them, with no rupee counted twice
   * and none missing. This is what a treasurer checks by hand on paper.
   */
  it("prints every rupee exactly once across the two sections", () => {
    const rows = [settled, pledged, half];
    const { settled: paid, open } = splitLedger(rows);

    const printedAsReceived = paid.reduce((n, r) => n + received(r), 0);
    const printedAsOwed = open.reduce((n, r) => n + outstanding(r), 0);
    const agreed = rows.reduce((n, r) => n + Number(r.amount), 0);

    expect(printedAsReceived).toBe(1400);
    expect(printedAsOwed).toBe(2600);
    expect(printedAsReceived + printedAsOwed).toBe(agreed);
  });

  it("leaves out a row that recorded a zero payment rather than printing ₹0", () => {
    const zero: Money = { amount: 500, paid_amount: 0, payment_status: "Unpaid" };
    const { settled: paid, open } = splitLedger([zero]);
    expect(paid).toHaveLength(0);
    expect(open).toHaveLength(1);
  });
});
