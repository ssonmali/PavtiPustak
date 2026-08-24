import { describe, expect, it } from "vitest";
import { donationSchema, expenseSchema, receiptSchema } from "@/lib/schemas";

const valid = {
  donor_name: "Sunil Patil",
  amount: "501",
  phone_number: "9876543210",
  payment_method: "Cash",
  collection_date: "2026-08-22",
};

describe("receiptSchema", () => {
  it("accepts a well-formed receipt and coerces the amount", () => {
    const result = receiptSchema.parse(valid);
    expect(result.amount).toBe(501);
    expect(typeof result.amount).toBe("number");
  });

  it.each([
    ["+91 98765 43210", "9876543210"],
    ["09876543210", "9876543210"],
    ["91-9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
  ])("normalises %s to %s", (input, expected) => {
    expect(receiptSchema.parse({ ...valid, phone_number: input }).phone_number)
      .toBe(expected);
  });

  it.each(["1234567890", "98765", "abcdefghij", ""])(
    "rejects the invalid mobile %s",
    (phone) => {
      expect(receiptSchema.safeParse({ ...valid, phone_number: phone }).success)
        .toBe(false);
    },
  );

  it("rejects zero and negative amounts", () => {
    expect(receiptSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...valid, amount: "-5" }).success).toBe(false);
  });

  it("rejects a payment method outside the DB constraint", () => {
    expect(receiptSchema.safeParse({ ...valid, payment_method: "Card" }).success)
      .toBe(false);
  });

  it("trims the donor name and rejects a blank one", () => {
    expect(receiptSchema.parse({ ...valid, donor_name: "  Sunil  " }).donor_name)
      .toBe("Sunil");
    expect(receiptSchema.safeParse({ ...valid, donor_name: "   " }).success)
      .toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(receiptSchema.safeParse({ ...valid, collection_date: "22/08/2026" }).success)
      .toBe(false);
  });

  it("defaults to Paid when no status is submitted", () => {
    const parsed = receiptSchema.parse(valid);
    expect(parsed.payment_status).toBe("Paid");
    expect(parsed.due_on).toBeNull();
  });

  it("requires a due date when unpaid", () => {
    expect(
      receiptSchema.safeParse({ ...valid, payment_status: "Unpaid" }).success,
    ).toBe(false);
    expect(
      receiptSchema.safeParse({
        ...valid,
        payment_status: "Unpaid",
        due_on: "2026-09-01",
      }).success,
    ).toBe(true);
  });

  it("drops a due date on a paid receipt, matching the DB constraint", () => {
    const parsed = receiptSchema.parse({
      ...valid,
      payment_status: "Paid",
      due_on: "2026-09-01",
    });
    expect(parsed.due_on).toBeNull();
  });

  it("rejects a malformed due date", () => {
    expect(
      receiptSchema.safeParse({
        ...valid,
        payment_status: "Unpaid",
        due_on: "01/09/2026",
      }).success,
    ).toBe(false);
  });
});

describe("expenseSchema", () => {
  const valid = {
    description: "Loudspeaker rent",
    amount: "2500",
    category: "Decoration",
    payment_method: "Cash",
    spent_on: "2026-08-22",
  };

  it("accepts a well-formed expense with no note", () => {
    const parsed = expenseSchema.parse(valid);
    expect(parsed.amount).toBe(2500);
    expect(parsed.note).toBeNull();
  });

  // A bill defaults to settled, so every form and every row recorded before
  // instalments existed still parses to the same thing it used to mean.
  it("defaults to paid, with no due date and no advance", () => {
    const parsed = expenseSchema.parse(valid);
    expect(parsed.payment_status).toBe("Paid");
    expect(parsed.due_on).toBeNull();
    expect(parsed.paid_amount).toBeNull();
  });

  it("requires a date on a bill that is not paid yet", () => {
    expect(
      expenseSchema.safeParse({ ...valid, payment_status: "Unpaid" }).success,
    ).toBe(false);
    expect(
      expenseSchema.safeParse({
        ...valid,
        payment_status: "Unpaid",
        due_on: "2026-09-01",
      }).success,
    ).toBe(true);
  });

  it("keeps a blank advance as null rather than a recorded zero", () => {
    const parsed = expenseSchema.parse({
      ...valid,
      payment_status: "Unpaid",
      due_on: "2026-09-01",
      paid_amount: "",
    });
    expect(parsed.paid_amount).toBeNull();
  });

  it("rejects an advance larger than the bill", () => {
    expect(
      expenseSchema.safeParse({
        ...valid,
        payment_status: "Unpaid",
        due_on: "2026-09-01",
        paid_amount: "3000",
      }).success,
    ).toBe(false);
  });

  // Otherwise the row would carry both "fully paid" and "1000 of it paid",
  // which the DB constraint rejects outright.
  it("clears the due date and the advance once the bill is settled", () => {
    const parsed = expenseSchema.parse({
      ...valid,
      payment_status: "Paid",
      due_on: "2026-09-01",
      paid_amount: "1000",
    });
    expect(parsed.due_on).toBeNull();
    expect(parsed.paid_amount).toBeNull();
  });

  it("stores a blank note as null, not an empty string", () => {
    expect(expenseSchema.parse({ ...valid, note: "   " }).note).toBeNull();
    expect(expenseSchema.parse({ ...valid, note: " Sharma " }).note).toBe(
      "Sharma",
    );
  });

  it("rejects a zero or negative amount", () => {
    expect(expenseSchema.safeParse({ ...valid, amount: "0" }).success).toBe(
      false,
    );
    expect(expenseSchema.safeParse({ ...valid, amount: "-100" }).success).toBe(
      false,
    );
  });

  it("rejects a category outside the DB constraint", () => {
    expect(
      expenseSchema.safeParse({ ...valid, category: "Fireworks" }).success,
    ).toBe(false);
    // Renamed to Mandap in migration 08; the old value must not slip through.
    expect(
      expenseSchema.safeParse({ ...valid, category: "Pandal" }).success,
    ).toBe(false);
  });

  it("rejects a blank description", () => {
    expect(
      expenseSchema.safeParse({ ...valid, description: "  " }).success,
    ).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      expenseSchema.safeParse({ ...valid, spent_on: "22/08/2026" }).success,
    ).toBe(false);
  });
});

describe("donationSchema", () => {
  const valid = {
    donor_name: "Sunil Patil",
    phone_number: "9876543210",
    item: "5kg rice",
    donation_date: "2026-08-22",
  };

  it("accepts a well-formed donation with no value", () => {
    const parsed = donationSchema.parse(valid);
    expect(parsed.value).toBeNull();
  });

  it("treats a blank value as null rather than zero", () => {
    expect(donationSchema.parse({ ...valid, value: "" }).value).toBeNull();
    expect(donationSchema.parse({ ...valid, value: "500" }).value).toBe(500);
  });

  it("rejects a zero or negative value when one is given", () => {
    expect(
      donationSchema.safeParse({ ...valid, value: "0" }).success,
    ).toBe(false);
    expect(
      donationSchema.safeParse({ ...valid, value: "-50" }).success,
    ).toBe(false);
  });

  it("rejects a blank item", () => {
    expect(
      donationSchema.safeParse({ ...valid, item: " " }).success,
    ).toBe(false);
  });

  it("normalises a phone number the same way a receipt does", () => {
    expect(
      donationSchema.parse({ ...valid, phone_number: "+91 98765 43210" })
        .phone_number,
    ).toBe("9876543210");
  });

  it("rejects a malformed date", () => {
    expect(
      donationSchema.safeParse({ ...valid, donation_date: "22/08/2026" })
        .success,
    ).toBe(false);
  });
});
