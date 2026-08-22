import writeXlsxFile, {
  type Row,
  type SheetData,
} from "write-excel-file/browser";
import type { Receipt } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Real .xlsx (not a renamed CSV), generated in the browser so no server
 * round-trip is needed. Marathi donor names survive because xlsx is UTF-8
 * throughout — the encoding gymnastics CSV needs don't apply.
 */
export async function exportReceiptsToExcel(
  receipts: Receipt[],
  dict: Dictionary,
  mandalName: string,
) {
  const header: Row = [
    { value: dict["table.no"], fontWeight: "bold" },
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
    { type: Date, value: parseDate(r.collection_date), format: "dd/mm/yyyy" },
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

  const data: SheetData = [header, ...rows, totalRow];

  await writeXlsxFile(data, {
    columns: [
      { width: 8 },
      { width: 28 },
      { width: 14 },
      { width: 16 },
      { width: 12 },
      { width: 14 },
    ],
    // Excel rejects : \ / ? * [ ] in sheet names, and caps them at 31 chars.
    sheet: mandalName.replace(/[:\\/?*[\]]/g, " ").slice(0, 30) || "Receipts",
    stickyRowsCount: 1,
  }).toFile(`pavti-pustak-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Local-calendar parse; `new Date(iso)` would shift the day in IST. */
function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
