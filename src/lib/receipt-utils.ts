import type { Receipt } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatAmount = (amount: number | string) =>
  inr.format(Number(amount));

/** `2026-08-22` -> `22 Aug 2026`, without timezone drift. */
export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Local `YYYY-MM-DD` — never use toISOString(), it shifts the day in IST. */
export function toDateValue(date: Date) {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
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

const CSV_HEADERS = [
  "Receipt No",
  "Donor Name",
  "Amount",
  "Phone",
  "Payment Method",
  "Collection Date",
  "Recorded At",
] as const;

/** Guards against CSV/formula injection when Excel opens the file. */
function csvCell(value: string | number) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function receiptsToCsv(receipts: Receipt[]) {
  const rows = receipts.map((r) =>
    [
      r.receipt_number,
      r.donor_name,
      Number(r.amount).toFixed(2),
      r.phone_number,
      r.payment_method,
      r.collection_date,
      new Date(r.created_at).toLocaleString("en-IN"),
    ]
      .map(csvCell)
      .join(","),
  );

  // BOM so Excel renders Marathi donor names correctly.
  return `﻿${CSV_HEADERS.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
}
