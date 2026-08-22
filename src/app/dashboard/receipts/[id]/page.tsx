import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Receipt } from "@/lib/types";
import { formatAmount, formatDate } from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { PrintBar } from "../../report/print-button";

export const metadata = { title: "Receipt · Pavti Pustak" };

/** A single donor-facing slip, sized for A5 so two fit on a sheet. */
export default async function ReceiptSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { locale, t } = await getDictionary();
  const mandalName = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal";

  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const receipt = data as Receipt;

  const rows = [
    { label: t("slip.amount"), value: formatAmount(receipt.amount), strong: true },
    { label: t("slip.method"), value: t(`method.${receipt.payment_method}`) },
    { label: t("slip.date"), value: formatDate(receipt.collection_date, locale) },
  ];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 print:max-w-none">
      <PrintBar printLabel={t("report.print")} backLabel={t("report.back")} />

      <article className="rounded-lg border bg-card p-5 text-card-foreground print:rounded-none print:border-2 print:p-6">
        <header className="border-b pb-3 text-center">
          <h1 className="text-lg font-semibold">{mandalName}</h1>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {t("slip.title")}
          </p>
        </header>

        <div className="flex items-baseline justify-between py-3 text-sm">
          <span className="text-muted-foreground">{t("slip.number")}</span>
          <span className="font-semibold tabular-nums">
            {receipt.receipt_number}
          </span>
        </div>

        <div className="border-y py-3">
          <p className="text-xs text-muted-foreground">{t("slip.received")}</p>
          <p className="wrap-anywhere text-base font-medium">
            {receipt.donor_name}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {receipt.phone_number}
          </p>
        </div>

        <dl className="flex flex-col gap-2 py-3 text-sm">
          {rows.map(({ label, value, strong }) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd
                className={
                  strong ? "text-lg font-semibold tabular-nums" : "tabular-nums"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <footer className="border-t pt-3 text-center">
          <p className="text-sm font-medium">{t("slip.thanks")}</p>
          {receipt.created_by_email ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("slip.collectedBy")}: {receipt.created_by_email}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
