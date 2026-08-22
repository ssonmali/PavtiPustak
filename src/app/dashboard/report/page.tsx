import { createClient } from "@/lib/supabase/server";
import type { Receipt } from "@/lib/types";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  toDateValue,
} from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { PrintBar } from "./print-button";

export const metadata = { title: "Report · Pavti Pustak" };

/** `?days=1|7|30|0` mirrors the dashboard's period filter; 0 = all time. */
function startOf(days: number) {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return toDateValue(d);
}

export default async function ReportPage({
  searchParams,
}: {
  // Typed explicitly: the generated PageProps helper only knows routes that
  // have already rendered, and this one redirects when unauthenticated.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { days } = await searchParams;
  const period = Number(Array.isArray(days) ? days[0] : days) || 0;

  const supabase = await createClient();
  const { locale, t } = await getDictionary();
  const mandalName = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal";

  const from = startOf(period);
  let query = supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: true })
    .order("receipt_number", { ascending: true })
    // A print report beyond this is not something anyone reads on paper.
    .limit(1000);
  if (from) query = query.gte("collection_date", from);

  const { data } = await query;
  const receipts: Receipt[] = data ?? [];
  const total = receipts.reduce((sum, r) => sum + Number(r.amount), 0);

  const periodLabel = from
    ? `${formatDate(from, locale)} — ${formatDate(toDateValue(new Date()), locale)}`
    : t("period.all");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-none">
      <PrintBar printLabel={t("report.print")} backLabel={t("report.back")} />

      <article className="overflow-x-auto rounded-lg border bg-card p-4 text-card-foreground sm:p-6 print:overflow-visible print:rounded-none print:border-0 print:p-0">
        <header className="border-b pb-4 text-center">
          <h1 className="text-xl font-semibold">{mandalName}</h1>
          <p className="text-sm text-muted-foreground">{t("report.title")}</p>
        </header>

        <dl className="grid grid-cols-2 gap-2 py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t("report.period")}</dt>
            <dd className="font-medium">{periodLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("stats.receipts")}</dt>
            <dd className="font-medium tabular-nums">{receipts.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("stats.total")}</dt>
            <dd className="font-medium tabular-nums">{formatAmount(total)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("report.generated")}</dt>
            <dd className="font-medium">
              {formatDateTime(new Date().toISOString(), locale)}
            </dd>
          </div>
        </dl>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-muted/50 text-left print:bg-transparent">
              <th className="p-2 font-medium">{t("table.no")}</th>
              <th className="p-2 font-medium">{t("table.donor")}</th>
              <th className="p-2 font-medium">{t("table.mobile")}</th>
              <th className="p-2 font-medium">{t("table.method")}</th>
              <th className="p-2 font-medium">{t("table.date")}</th>
              <th className="p-2 text-right font-medium">{t("table.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 tabular-nums">{r.receipt_number}</td>
                <td className="p-2">{r.donor_name}</td>
                <td className="p-2 tabular-nums">{r.phone_number}</td>
                <td className="p-2">{t(`method.${r.payment_method}`)}</td>
                <td className="p-2 whitespace-nowrap">
                  {formatDate(r.collection_date, locale)}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {formatAmount(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b-2 font-semibold">
              <td className="p-2" colSpan={5}>
                {t("report.grandTotal")}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatAmount(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
