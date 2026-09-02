import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  receiptBaseline,
  receiptFields,
  sameReceiptFields,
} from "@/lib/receipt-fields";
import type { Receipt } from "@/lib/types";

/** A stored row, as Postgres hands it back. */
const stored: Receipt = {
  id: "server-1",
  receipt_number: 47,
  donor_name: "Ramesh Patil",
  donor_name_mr: "रमेश पाटील",
  amount: 501,
  paid_amount: null,
  phone_number: "9876543210",
  payment_method: "Cash",
  payment_status: "Paid",
  collection_date: "2026-08-20",
  due_on: null,
  created_at: "2026-08-20T10:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
  user_id: "u1",
  created_by_email: "a@b.c",
};

/** The form, untouched, for the row above. */
function untouched() {
  return receiptFields({
    donor_name: "Ramesh Patil",
    donor_name_mr: "रमेश पाटील",
    amount: "501",
    paid_amount: "",
    phone_number: "9876543210",
    payment_method: "Cash",
    collection_date: "2026-08-20",
    payment_status: "Paid",
    due_on: "",
  });
}

describe("normalizePhone", () => {
  /**
   * Volunteers copy numbers off whatever they were written on, so the same
   * number arrives in several spellings and has to settle into one.
   */
  it("strips spaces and dashes", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
  });

  it("strips a country code or a leading zero", () => {
    expect(normalizePhone("+919876543210")).toBe("9876543210");
    expect(normalizePhone("919876543210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it("leaves a plain ten-digit number alone", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });
});

describe("receiptFields", () => {
  it("reads a number typed as text as a number", () => {
    expect(receiptFields({ amount: "501" }).amount).toBe(501);
  });

  it("treats a blank Marathi name as absent, not as an empty string", () => {
    expect(receiptFields({ donor_name_mr: "   " }).donor_name_mr).toBeNull();
  });

  it("trims the donor's name", () => {
    expect(receiptFields({ donor_name: "  Ramesh  " }).donor_name).toBe(
      "Ramesh",
    );
  });

  /**
   * A settled receipt carries neither figure — the database constrains both to
   * null. Normalising here is what stops a stale due date, left in the form
   * when the status flipped to Paid, from counting as a change.
   */
  it("clears the part-payment and due date on a paid receipt", () => {
    const f = receiptFields({
      payment_status: "Paid",
      paid_amount: "200",
      due_on: "2026-09-01",
    });
    expect(f.paid_amount).toBeNull();
    expect(f.due_on).toBeNull();
  });

  it("keeps both on an unpaid one", () => {
    const f = receiptFields({
      payment_status: "Unpaid",
      paid_amount: "200",
      due_on: "2026-09-01",
    });
    expect(f.paid_amount).toBe(200);
    expect(f.due_on).toBe("2026-09-01");
  });

  it("reads a part-payment of zero as none paid at all", () => {
    // Zero and blank mean the same thing here, and the column stores null.
    expect(
      receiptFields({ payment_status: "Unpaid", paid_amount: "0" }).paid_amount,
    ).toBeNull();
  });

  it("defaults the method and status rather than leaving them empty", () => {
    const f = receiptFields({});
    expect(f.payment_method).toBe("Cash");
    expect(f.payment_status).toBe("Paid");
  });
});

describe("sameReceiptFields", () => {
  /**
   * The case that was reported: open a receipt, change nothing, save. It wrote
   * the row anyway, bumped updated_at and logged an edit that never happened.
   */
  it("says an untouched form matches the stored row", () => {
    expect(sameReceiptFields(untouched(), receiptBaseline(stored))).toBe(true);
  });

  it("is not fooled by a phone number written differently", () => {
    const form = receiptFields({
      ...untouched(),
      phone_number: "+91 98765-43210",
    });
    expect(sameReceiptFields(form, receiptBaseline(stored))).toBe(true);
  });

  /** Postgres numeric arrives as a string; the form submits one too. */
  it("is not fooled by an amount arriving as a string", () => {
    const asText = receiptBaseline({
      ...stored,
      amount: "501" as unknown as number,
    });
    expect(sameReceiptFields(untouched(), asText)).toBe(true);
  });

  it("notices every field a volunteer can change", () => {
    const base = receiptBaseline(stored);
    const changes: Partial<Record<string, unknown>>[] = [
      { donor_name: "Ramesh Patel" },
      { donor_name_mr: "रमेश" },
      { amount: "1001" },
      { phone_number: "9000000000" },
      { payment_method: "UPI" },
      { collection_date: "2026-08-21" },
      { payment_status: "Unpaid" },
    ];
    for (const change of changes) {
      const edited = receiptFields({ ...untouched(), ...change });
      expect(sameReceiptFields(edited, base), JSON.stringify(change)).toBe(
        false,
      );
    }
  });

  it("notices a part-payment and a due date on an unpaid receipt", () => {
    const pledge = receiptBaseline({
      ...stored,
      payment_status: "Unpaid",
      paid_amount: 200,
      due_on: "2026-09-01",
    });
    const asForm = {
      ...untouched(),
      payment_status: "Unpaid" as const,
      paid_amount: "200",
      due_on: "2026-09-01",
    };
    expect(sameReceiptFields(receiptFields(asForm), pledge)).toBe(true);
    expect(
      sameReceiptFields(receiptFields({ ...asForm, paid_amount: "300" }), pledge),
    ).toBe(false);
    expect(
      sameReceiptFields(
        receiptFields({ ...asForm, due_on: "2026-09-02" }),
        pledge,
      ),
    ).toBe(false);
  });

  /**
   * Marking a pledge paid clears both extra fields, so this must read as a
   * change even though two of the three differences are the normaliser's doing.
   */
  it("sees settling a pledge as a change", () => {
    const pledge = receiptBaseline({
      ...stored,
      payment_status: "Unpaid",
      paid_amount: 200,
      due_on: "2026-09-01",
    });
    expect(sameReceiptFields(untouched(), pledge)).toBe(false);
  });
});
