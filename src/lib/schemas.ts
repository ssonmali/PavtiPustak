import { z } from "zod";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/types";

/** Shared client + server validation for a receipt. */
export const receiptSchema = z.object({
  donor_name: z
    .string()
    .trim()
    .min(2, "Donor name is required.")
    .max(120, "Donor name is too long."),
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "That amount looks like a typo."),
  phone_number: z
    .string()
    .trim()
    // Accept 98xxxxxxxx, +91 98xxxxxxxx, 0-prefixed, or spaced — normalised below.
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""))
    .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number."),
  payment_method: z.enum(PAYMENT_METHODS, { message: "Choose a payment method." }),
  collection_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a collection date.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date."),
});

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
});

export type ExpenseFormValues = z.input<typeof expenseSchema>;
