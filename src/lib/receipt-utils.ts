import type { Receipt } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatAmount = (amount: number | string) =>
  inr.format(Number(amount));

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

/** Bilingual thank-you note, opened through the wa.me web intent. */
export function whatsappUrl(receipt: Receipt, mandalName: string) {
  const message = [
    `🙏 *${mandalName}* 🙏`,
    "",
    `प्रिय ${receipt.donor_name},`,
    `आपल्या वर्गणीसाठी मनःपूर्वक आभार! 🌺`,
    "",
    `पावती क्रमांक: *${receipt.receipt_number}*`,
    `रक्कम: *${formatAmount(receipt.amount)}*`,
    `दिनांक: *${formatDate(receipt.collection_date)}*`,
    `माध्यम: *${receipt.payment_method}*`,
    "",
    `Thank you for your generous contribution of ${formatAmount(receipt.amount)}.`,
    `Receipt No: ${receipt.receipt_number} | ${formatDate(receipt.collection_date)}`,
    "",
    `गणपती बाप्पा मोरया! 🎉`,
  ].join("\n");

  // 91 = India country code; phone_number is stored as 10 digits.
  return `https://wa.me/91${receipt.phone_number}?text=${encodeURIComponent(message)}`;
}
