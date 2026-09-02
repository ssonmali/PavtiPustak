import type { PaymentMethod, PaymentStatus, Receipt } from "./types";

/**
 * The editable content of a receipt, normalised.
 *
 * Exactly the fields the form can change — the identity columns (id, number,
 * who collected it) are pinned by the database and are not here. One shape,
 * produced two ways: from the form as it stands, and from the stored row. That
 * is the point of the module. Comparing a form against a row only tells the
 * truth if both went through the same normalisation, or an untouched phone
 * number stored as "+919876543210" reads as an edit against the "9876543210"
 * the form would submit.
 */
export type ReceiptFields = {
  donor_name: string;
  donor_name_mr: string | null;
  amount: number;
  paid_amount: number | null;
  phone_number: string;
  payment_method: PaymentMethod;
  collection_date: string;
  payment_status: PaymentStatus;
  due_on: string | null;
};

/** What either source hands over before it is cleaned up. */
export type RawReceiptFields = {
  donor_name?: string | null;
  donor_name_mr?: string | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  phone_number?: string | null;
  payment_method?: string | null;
  collection_date?: string | null;
  payment_status?: string | null;
  due_on?: string | null;
};

/**
 * A mobile number as ten digits.
 *
 * Volunteers type these however they are written down — spaces, dashes, a
 * country code — so the same number reaches us in several spellings and has to
 * settle into one before it can be stored or compared.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "");
}

/** A blank text field means "no value", not an empty string. */
function orNull(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function receiptFields(raw: RawReceiptFields): ReceiptFields {
  const payment_status = (String(raw.payment_status ?? "Paid") ||
    "Paid") as PaymentStatus;
  // A settled receipt carries neither a part-payment nor a due date: the
  // database constrains both to null, so normalising here keeps a status
  // change from leaving a stale figure behind to compare against.
  const unpaid = payment_status === "Unpaid";

  return {
    donor_name: String(raw.donor_name ?? "").trim(),
    donor_name_mr: orNull(raw.donor_name_mr),
    amount: Number(raw.amount ?? 0),
    paid_amount: unpaid ? Number(raw.paid_amount ?? 0) || null : null,
    phone_number: normalizePhone(String(raw.phone_number ?? "")),
    payment_method: (String(raw.payment_method ?? "Cash") ||
      "Cash") as PaymentMethod,
    collection_date: String(raw.collection_date ?? ""),
    payment_status,
    due_on: unpaid ? orNull(raw.due_on) : null,
  };
}

/** The stored row, in the same shape the form produces. */
export function receiptBaseline(receipt: Receipt): ReceiptFields {
  return receiptFields(receipt);
}

/**
 * Whether two versions of a receipt say the same thing.
 *
 * Used to keep Save disabled until something has actually changed. Opening a
 * receipt, changing nothing and saving used to write the row anyway, which
 * bumped updated_at and put a meaningless entry in the activity log — the log
 * is how the mandal reviews who touched what, so noise in it costs real
 * trust.
 */
export function sameReceiptFields(a: ReceiptFields, b: ReceiptFields): boolean {
  return (
    a.donor_name === b.donor_name &&
    a.donor_name_mr === b.donor_name_mr &&
    a.amount === b.amount &&
    a.paid_amount === b.paid_amount &&
    a.phone_number === b.phone_number &&
    a.payment_method === b.payment_method &&
    a.collection_date === b.collection_date &&
    a.payment_status === b.payment_status &&
    a.due_on === b.due_on
  );
}
