import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/types";

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
