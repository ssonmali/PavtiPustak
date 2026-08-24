import type { NameMap, PaymentStatus, Receipt } from "@/lib/types";
import { toDevanagariName } from "@/lib/devanagari-name";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatAmount = (amount: number | string) =>
  inr.format(Number(amount));

const inrDevanagari = new Intl.NumberFormat("mr-IN-u-nu-deva", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Devanagari digits (१, २, ३…) — for the shared image, not the rest of the app. */
export const formatAmountMarathi = (amount: number | string) =>
  inrDevanagari.format(Number(amount));

const digitsDevanagari = new Intl.NumberFormat("mr-IN-u-nu-deva", {
  useGrouping: false,
});

/** Plain Devanagari digits, no currency symbol — for the receipt number. */
export const formatNumberMarathi = (n: number | string) =>
  digitsDevanagari.format(Number(n));

/**
 * `2026-08-22` -> `22 Aug 2026`.
 *
 * Built on Date.UTC and formatted in UTC on purpose: a date-only column has no
 * timezone, and anything that reads the host's zone renders differently on the
 * server than in the browser, which breaks hydration.
 */
export function formatDate(isoDate: string, locale: "mr" | "en" = "en") {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    locale === "mr" ? "mr-IN" : "en-IN",
    { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" },
  );
}

/** Short axis/tick form: `22 Aug`. Same UTC discipline as formatDate. */
export function formatDateShort(isoDate: string, locale: "mr" | "en" = "en") {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    locale === "mr" ? "mr-IN" : "en-IN",
    { day: "numeric", month: "short", timeZone: "UTC" },
  );
}

/**
 * The `YYYY-MM-DD` an instant falls on in the mandal's zone. `en-CA` is used
 * because it formats as ISO, and the explicit zone keeps it deterministic.
 */
export function dayOf(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Today in the mandal's zone. Used on the server, where the process clock is
 * UTC and `new Date()` would roll the day over five and a half hours early.
 */
export function todayInIst() {
  return dayOf(new Date().toISOString());
}

/** Just the clock time of an instant, for grouped lists that show the day once. */
export function formatTime(iso: string, locale: "mr" | "en" = "en") {
  return new Date(iso).toLocaleTimeString(locale === "mr" ? "mr-IN" : "en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * A `timestamptz` rendered in the mandal's own zone with an explicit locale, so
 * the server and the browser produce identical text.
 */
export function formatDateTime(iso: string, locale: "mr" | "en" = "en") {
  return new Date(iso).toLocaleString(locale === "mr" ? "mr-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Local `YYYY-MM-DD` — never use toISOString(), it shifts the day in IST. */
export function toDateValue(date: Date) {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * A date-only column as UTC midnight.
 *
 * Spreadsheet serial numbers are counted from `getTime()`, which is UTC — so a
 * local-midnight Date in IST lands at 18:30 the previous day and Excel displays
 * the day before the one that was recorded.
 */
export function utcMidnight(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * The name to show for a volunteer: the one they set, or one derived from their
 * email address when they have not set one.
 *
 * Attribution is stored as an email on every receipt and audit row, so the
 * lookup is by address rather than by user id — which also means a volunteer
 * naming themselves renames their whole history at once.
 */
export function displayName(
  email: string | null | undefined,
  names?: NameMap,
) {
  if (!email) return null;
  return names?.[email.toLowerCase()] ?? volunteerName(email);
}

/**
 * A readable volunteer name from a login email.
 *
 * Accounts are created by hand in the Supabase dashboard, so there is no
 * profile record to read a real name from — the local part of the address is
 * the only name the app has. `sanket.sonmali@…` reads as "Sanket Sonmali".
 * Addresses that are not name-shaped are left recognisable rather than
 * mangled: `ganesh123@…` becomes "Ganesh 123".
 */
export function volunteerName(email: string | null | undefined) {
  if (!email) return null;

  // A `+tag` suffix is routing, not part of anyone's name.
  const local = email.split("@")[0].split("+")[0];
  if (!local) return email;

  const words = local
    .split(/[._-]+/)
    // A digit run is its own word: `ganesh123` reads better as "Ganesh 123".
    .flatMap((part) => part.match(/\d+|\D+/g) ?? [])
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

  return words.length > 0 ? words.join(" ") : email;
}


/**
 * The two rules for what a row is worth. Everything that shows money must go
 * through these — a total that sums `amount` directly is wrong the moment a
 * row is part-paid, and it is wrong silently.
 *
 * A row carries the agreed figure in `amount` and how much of it has actually
 * changed hands in `paid_amount`. `payment_status` stays the record of whether
 * it is settled, which keeps every pre-existing row correct: a Paid row has
 * moved its whole amount, and an untouched one has moved nothing.
 *
 * Structural rather than `Pick<Receipt, …>` on purpose: contributions coming in
 * and bills going out follow the identical rule, so both ledgers share these
 * four functions instead of each growing its own near-copy.
 */
export type Money = {
  amount: number;
  paid_amount: number | null;
  payment_status: PaymentStatus;
};

/** Money actually moved for this row — in the box, or out of it. */
export function received(r: Money): number {
  if (r.payment_status === "Paid") return Number(r.amount);
  return Number(r.paid_amount ?? 0);
}

/** Money still owed on this row — to the mandal, or by it. Zero once settled. */
export function outstanding(r: Money): number {
  if (r.payment_status === "Paid") return 0;
  return Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0));
}

/** Some money in, but not all of it — the state that needs its own rendering. */
export function isPartPaid(r: Money): boolean {
  return r.payment_status !== "Paid" && received(r) > 0 && outstanding(r) > 0;
}

/**
 * Whether a receipt may be sent to the contributor.
 *
 * A receipt is a document saying "we received this". Sending one for a
 * contribution that is still half outstanding hands over a false record, so the
 * share button is gated on this rather than on payment_status alone.
 */
export function isFullyPaid(r: Money): boolean {
  return outstanding(r) === 0;
}

/** NEXT_PUBLIC_* is inlined at build time, so this reads on server and client alike. */
const MANDAL_ADDRESS = process.env.NEXT_PUBLIC_MANDAL_ADDRESS ?? null;

/**
 * The donor's name as the Marathi messages and the receipt image should show
 * it: the spelling a volunteer corrected if there is one, otherwise a
 * transliteration of what was typed.
 */
export function marathiDonor(receipt: Pick<Receipt, "donor_name" | "donor_name_mr">) {
  return receipt.donor_name_mr?.trim() || toDevanagariName(receipt.donor_name);
}

/** Marathi thank-you note, opened through the wa.me web intent. */
export function whatsappUrl(receipt: Receipt, mandalName: string) {
  const message = [
    `🙏 ${mandalName} 🙏`,
    ...(MANDAL_ADDRESS ? [`     ${MANDAL_ADDRESS}`] : []),
    "",
    `आदरणीय ${marathiDonor(receipt)},`,
    `आपल्या वर्गणीसाठी मनःपूर्वक आभार! 🌺`,
    "",
    `पावती क्रमांक: ${receipt.receipt_number}`,
    `रक्कम: ${formatAmount(receipt.amount)}`,
    `दिनांक: ${formatDate(receipt.collection_date)}`,
    `माध्यम: ${receipt.payment_method}`,
    "",
    `आपल्या बहुमोल सहकार्यामुळे गणेशोत्सव अधिक उत्साहात आणि भक्तिमय वातावरणात साजरा करण्यास मोलाची मदत होईल. 🌺`,
    "",
    `🌸 आपल्या योगदानाबद्दल पुन्हा एकदा मनःपूर्वक आभार! 🌸`,
    "",
    `🚩🙏 गणपती बाप्पा मोरया🎉`,
  ].join("\n");

  // 91 = India country code; phone_number is stored as 10 digits.
  return `https://wa.me/91${receipt.phone_number}?text=${encodeURIComponent(message)}`;
}

/**
 * A polite nudge for a pledge that has come due.
 *
 * Deliberately separate from `whatsappUrl`: that message thanks someone for
 * money received and quotes a receipt number, which would be a false receipt
 * for a contribution still owed.
 */
export function pledgeReminderUrl(receipt: Receipt, mandalName: string) {
  const due = receipt.due_on ? formatDate(receipt.due_on) : "";
  // The remainder, not the agreed amount: asking someone who has already paid
  // half for the whole thing again is the one mistake this message must not
  // make. `paid` is named too, so the figure is checkable rather than assumed.
  const owed = outstanding(receipt);
  const paid = received(receipt);
  const message = [
    `🙏 *${mandalName}* 🙏`,
    "",
    `प्रिय ${marathiDonor(receipt)},`,
    ...(paid > 0
      ? [
          `आपण कबूल केलेल्या *${formatAmount(receipt.amount)}* वर्गणीपैकी`,
          `*${formatAmount(paid)}* मिळाली आहे. उर्वरित *${formatAmount(owed)}*`,
        ]
      : [`आपण कबूल केलेली *${formatAmount(owed)}* वर्गणी`]),
    due ? `*${due}* पर्यंत अपेक्षित आहे.` : `अपेक्षित आहे.`,
    `सोयीनुसार देण्याची विनंती. 🌺`,
    "",
    `A gentle reminder about the ${formatAmount(owed)} still outstanding on your pledged contribution${due ? `, expected by ${due}` : ""}.`,
    "",
    `गणपती बाप्पा मोरया! 🎉`,
  ].join("\n");

  return `https://wa.me/91${receipt.phone_number}?text=${encodeURIComponent(message)}`;
}
