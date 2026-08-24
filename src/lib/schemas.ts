import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/lib/types";

/** Accepts 98xxxxxxxx, +91 98xxxxxxxx, 0-prefixed, or spaced — normalised. */
const phoneNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number.");

/** Shared client + server validation for a receipt. */
export const receiptSchema = z.object({
  donor_name: z
    .string()
    .trim()
    .min(2, "Donor name is required.")
    .max(120, "Donor name is too long."),
  // Optional: blank means the app transliterates donor_name for the image
  // instead. Handled as a string first so "" becomes null, not a value.
  donor_name_mr: z
    .string()
    .trim()
    .max(120, "That name is too long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "That amount looks like a typo."),
  // How much of `amount` has been received so far, for a contribution paid in
  // instalments. Validated as a string first: z.coerce.number() turns a blank
  // field into 0, which is indistinguishable from "nothing received yet" and
  // would quietly persist a zero instead of a null.
  paid_amount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || !Number.isNaN(Number(v)),
      "Enter a valid amount.",
    )
    .transform((v) => (v === null ? null : Number(v)))
    .refine((v) => v === null || v >= 0, "That cannot be negative."),
  phone_number: phoneNumberSchema,
  payment_method: z.enum(PAYMENT_METHODS, { message: "Choose a payment method." }),
  collection_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a collection date.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date."),
  // Defaults to Paid, matching the column default: a form or a queued offline
  // entry from before this field existed still parses.
  payment_status: z
    .enum(PAYMENT_STATUSES, {
      message: "Choose whether the money has been received.",
    })
    .default("Paid"),
  /** Only meaningful when unpaid; the refinement below enforces the pairing. */
  due_on: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})
  // Mirrors the DB constraint: exactly one shape per state. An unpaid row with
  // no date would never surface in the reminder list.
  .refine((v) => v.payment_status !== "Unpaid" || v.due_on !== null, {
    message: "Choose the date the money is expected.",
    path: ["due_on"],
  })
  .refine(
    (v) =>
      v.due_on === null || /^\d{4}-\d{2}-\d{2}$/.test(v.due_on),
    { message: "Choose a valid expected date.", path: ["due_on"] },
  )
  // Part-paid cannot exceed the contribution itself, or the remainder goes
  // negative and the reminder chases a refund.
  .refine((v) => v.paid_amount === null || v.paid_amount <= v.amount, {
    message: "That is more than the contribution.",
    path: ["paid_amount"],
  })
  // A paid receipt carries no due date, and no partial figure either: the whole
  // amount is received, so a leftover paid_amount would be a second, redundant
  // record of the same money.
  .transform((v) =>
    v.payment_status === "Paid"
      ? { ...v, due_on: null, paid_amount: null }
      : v,
  );

export type ReceiptFormValues = z.input<typeof receiptSchema>;

/** Shared client + server validation for an expense. */
export const expenseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "Say what the money went on.")
    .max(120, "Description is too long."),
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "That amount looks like a typo."),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Choose a category." }),
  payment_method: z.enum(PAYMENT_METHODS, { message: "Choose a payment method." }),
  spent_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was spent.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date."),
  // Optional, and stored as null rather than "" so the column stays meaningful.
  note: z
    .string()
    .trim()
    .max(500, "Note is too long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  // A bill can be committed before it is settled, and settled in instalments.
  // The three fields and all four refinements deliberately mirror the receipt
  // side above: one rule for money owed, whichever direction it flows.
  payment_status: z
    .enum(PAYMENT_STATUSES, {
      message: "Choose whether the money has been paid.",
    })
    .default("Paid"),
  due_on: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  // As with a receipt: validated as a string first, because z.coerce.number()
  // turns a blank field into 0 and would persist a zero where null is meant.
  paid_amount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || !Number.isNaN(Number(v)),
      "Enter a valid amount.",
    )
    .transform((v) => (v === null ? null : Number(v)))
    .refine((v) => v === null || v >= 0, "That cannot be negative."),
})
  .refine((v) => v.payment_status !== "Unpaid" || v.due_on !== null, {
    message: "Choose the date the bill is to be paid.",
    path: ["due_on"],
  })
  .refine((v) => v.due_on === null || /^\d{4}-\d{2}-\d{2}$/.test(v.due_on), {
    message: "Choose a valid date.",
    path: ["due_on"],
  })
  .refine((v) => v.paid_amount === null || v.paid_amount <= v.amount, {
    message: "That is more than the bill.",
    path: ["paid_amount"],
  })
  // A settled bill carries no due date and no partial figure: the whole amount
  // has gone out, so either would be a second, contradictory record of it.
  .transform((v) =>
    v.payment_status === "Paid" ? { ...v, due_on: null, paid_amount: null } : v,
  );

export type ExpenseFormValues = z.input<typeof expenseSchema>;

/** Shared client + server validation for a donation box entry. */
export const donationSchema = z.object({
  donor_name: z
    .string()
    .trim()
    .min(2, "Donor name is required.")
    .max(120, "Donor name is too long."),
  // Optional here (unlike a receipt): a donor dropping off items in person is
  // often not asked for a number, so blank is handled as a string first, the
  // same way as `value` below, rather than requiring a valid 10-digit number.
  phone_number: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) =>
        v === null ||
        /^[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "")),
      "Enter a valid 10-digit mobile number.",
    )
    .transform((v) =>
      v === null ? null : v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""),
    ),
  item: z
    .string()
    .trim()
    .min(2, "Say what was donated.")
    .max(160, "That description is too long."),
  // Optional: most donation-box entries are items, not cash, so a value is a
  // note for the record rather than something required. z.coerce would turn
  // an empty field into 0 and fail the positive check, so blank is handled
  // as a string first, before it ever becomes a number.
  value: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || !Number.isNaN(Number(v)),
      "Enter a valid amount.",
    )
    .transform((v) => (v === null ? null : Number(v)))
    .refine((v) => v === null || v > 0, "Value must be greater than zero.")
    .refine(
      (v) => v === null || v <= 10_000_000,
      "That value looks like a typo.",
    ),
  donation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date."),
});

export type DonationFormValues = z.input<typeof donationSchema>;
