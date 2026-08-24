import writeXlsxFile, { type Row, type SheetData } from "write-excel-file/browser";
import type { Donation, Receipt } from "@/lib/types";
import { utcMidnight } from "@/lib/receipt-utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Excel rejects `: \ / ? * [ ]` in sheet names, and caps them at 31 chars. */
function sheetName(name: string, fallback: string) {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 30) || fallback;
}

function receiptsSheetData(receipts: Receipt[], dict: Dictionary): SheetData {
  const header: Row = [
    // The spreadsheet stands alone, so the column says what the number is —
    // wrapped onto two lines rather than widening the column to fit it.
    { value: dict["slip.number"], fontWeight: "bold", wrap: true },
    { value: dict["table.donor"], fontWeight: "bold" },
    { value: dict["table.amount"], fontWeight: "bold", align: "right" },
    { value: dict["table.mobile"], fontWeight: "bold" },
    { value: dict["table.method"], fontWeight: "bold" },
    { value: dict["table.date"], fontWeight: "bold" },
  ];

  const rows: Row[] = receipts.map((r) => [
    { type: Number, value: r.receipt_number },
    { type: String, value: r.donor_name },
    { type: Number, value: Number(r.amount), format: "#,##0.00" },
    // Kept as text so Excel doesn't strip the leading digit or use sci notation.
    { type: String, value: r.phone_number },
    { type: String, value: dict[`method.${r.payment_method}`] },
    {
      type: Date,
      value: utcMidnight(r.collection_date),
      format: "dd/mm/yyyy",
    },
  ]);

  const total = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalRow: Row = [
    null,
    { value: dict["stats.total"], fontWeight: "bold" },
    { type: Number, value: total, fontWeight: "bold", format: "#,##0.00" },
    null,
    null,
    null,
  ];

  return [header, ...rows, totalRow];
}

/**
 * Its own sheet rather than appended rows: a donation has no payment method
 * and its value is often blank, so it does not fit the receipts columns —
 * and it must never land in the same total as a contribution.
 */
function donationsSheetData(donations: Donation[], dict: Dictionary): SheetData {
  const header: Row = [
    { value: dict["donation.number"], fontWeight: "bold" },
    { value: dict["donation.donor"], fontWeight: "bold" },
    { value: dict["table.mobile"], fontWeight: "bold" },
    { value: dict["donation.item"], fontWeight: "bold" },
    { value: dict["donation.value"], fontWeight: "bold", align: "right" },
    { value: dict["donation.date"], fontWeight: "bold" },
  ];

  const rows: Row[] = donations.map((d) => [
    { type: Number, value: d.donation_number },
    { type: String, value: d.donor_name },
    d.phone_number != null ? { type: String, value: d.phone_number } : null,
    { type: String, value: d.item },
    d.value != null
      ? { type: Number, value: Number(d.value), format: "#,##0.00" }
      : null,
    { type: Date, value: utcMidnight(d.donation_date), format: "dd/mm/yyyy" },
  ]);

  return [header, ...rows];
}

/**
 * Real .xlsx (not a renamed CSV), generated in the browser so no server
 * round-trip is needed. Marathi donor names survive because xlsx is UTF-8
 * throughout — the encoding gymnastics CSV needs don't apply.
 */
export async function exportReceiptsToExcel(
  receipts: Receipt[],
  dict: Dictionary,
  mandalName: string,
  /** Appended to the filename so a range is identifiable on disk. */
  slug = new Date().toISOString().slice(0, 10),
  /** Donation-box rows, exported as a separate sheet when there are any. */
  donations: Donation[] = [],
) {
  const sheets = [
    {
      data: receiptsSheetData(receipts, dict),
      sheet: sheetName(mandalName, "Receipts"),
      columns: [
        { width: 9 },
        { width: 28 },
        { width: 14 },
        { width: 16 },
        { width: 12 },
        { width: 14 },
      ],
      stickyRowsCount: 1,
    },
    ...(donations.length > 0
      ? [
          {
            data: donationsSheetData(donations, dict),
            sheet: dict["donation.title"].slice(0, 30),
            columns: [
              { width: 7 },
              { width: 28 },
              { width: 16 },
              { width: 28 },
              { width: 14 },
              { width: 14 },
            ],
            stickyRowsCount: 1,
          },
        ]
      : []),
  ];

  await writeXlsxFile(sheets).toFile(`pavti-pustak-${slug}.xlsx`);
}
