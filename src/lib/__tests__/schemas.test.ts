import { describe, expect, it } from "vitest";
import { receiptSchema } from "@/lib/schemas";

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
});
