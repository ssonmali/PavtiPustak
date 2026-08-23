import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVolunteerNames } from "@/lib/volunteer-names";
import type { Receipt } from "@/lib/types";
import { displayName, formatAmount, formatDate } from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { PrintBar } from "../../print-bar";

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
  const mandalName = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal";

  const [{ data }, names] = await Promise.all([
    supabase.from("receipts").select("*").eq("id", id).maybeSingle(),
    getVolunteerNames(),
  ]);

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
        {/* A slip for money still owed is not a receipt, and must not be able
            to be handed over as one. */}
        {receipt.payment_status === "Unpaid" ? (
          <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm font-semibold text-destructive">
            {t("slip.unpaid", {
              date: receipt.due_on ? formatDate(receipt.due_on, locale) : "—",
            })}
          </p>
        ) : null}
        <header className="border-b pb-3 text-center">
          <h1 className="font-display text-xl">{mandalName}</h1>
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
              {t("slip.collectedBy")}:{" "}
              {displayName(receipt.created_by_email, names)}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
