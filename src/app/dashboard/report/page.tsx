import { createClient } from "@/lib/supabase/server";
import type { Receipt } from "@/lib/types";
import { formatAmount, formatDate, formatDateTime } from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { ReportToolbar } from "./report-toolbar";
import { parseRange, parseStatus, type ReportRange } from "./report-range";

export const metadata = { title: "Report · Pavti Pustak" };

/** A print report longer than this is not something anyone reads on paper. */
const MAX_ROWS = 1000;

function rangeLabel(range: ReportRange, locale: "mr" | "en", allLabel: string) {
  const { from, to } = range;
  if (!from && !to) return allLabel;
  if (from && from === to) return formatDate(from, locale);
  const left = from ? formatDate(from, locale) : "…";
  const right = to ? formatDate(to, locale) : "…";
  return `${left} — ${right}`;
}

export default async function ReportPage({
  searchParams,
}: {
  // Typed explicitly: the generated PageProps helper only knows routes that
  // have already rendered, and this one redirects when unauthenticated.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const range = parseRange(params);
  const status = parseStatus(params);

  const supabase = await createClient();
  const { locale, t } = await getDictionary();
  const mandalName = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal";

  let query = supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: true })
    .order("receipt_number", { ascending: true })
    .limit(MAX_ROWS);
  if (range.from) query = query.gte("collection_date", range.from);
  if (range.to) query = query.lte("collection_date", range.to);

  const { data } = await query;
  const all: Receipt[] = data ?? [];

  // Printed as two sections rather than one mixed list: on paper a column of
  // amounts that silently includes money nobody paid cannot be reconciled.
  const paid = all.filter((r) => r.payment_status === "Paid");
  const unpaid = all.filter((r) => r.payment_status === "Unpaid");

  const sum = (rows: Receipt[]) =>
    rows.reduce((n, r) => n + Number(r.amount), 0);
  const total = sum(paid);
  const expected = sum(unpaid);

  // What the Excel export and the row cap notice count.
  const receipts = status === "all" ? all : status === "Paid" ? paid : unpaid;

  const sections = [
    { key: "Paid" as const, rows: paid, label: t("status.paidOnly") },
    { key: "Unpaid" as const, rows: unpaid, label: t("status.unpaidOnly") },
  ].filter((s) => (status === "all" ? s.rows.length > 0 : s.key === status));
  const periodLabel = rangeLabel(range, locale, t("period.all"));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-none">
      <ReportToolbar
        range={range}
        status={status}
        labels={{
          statusAll: t("status.all"),
          statusPaid: t("status.paidOnly"),
          statusUnpaid: t("status.unpaidOnly"),
          today: t("period.today"),
          all: t("period.all"),
          from: t("report.from"),
          to: t("report.to"),
          apply: t("report.apply"),
          export: t("report.export"),
          pdf: t("export.pdf"),
          excel: t("export.excel"),
          back: t("report.back"),
        }}
        receipts={receipts}
        mandalName={mandalName}
      />

      {receipts.length === MAX_ROWS && (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm print:hidden">
          {t("report.limit", { count: MAX_ROWS })}
        </p>
      )}

      <article className="overflow-x-auto rounded-lg border bg-card p-4 text-card-foreground sm:p-6 print:overflow-visible print:rounded-none print:border-0 print:p-0">
        <header className="pb-4 text-center">
          <h1 className="font-display text-2xl font-bold">{mandalName}</h1>
          <p className="text-sm font-semibold tracking-wide uppercase">
            {t("report.title")}
          </p>
        </header>

        {/* Summary is a table too, so the whole report reads as one ruled grid
            on paper rather than a loose caption above a table. */}
        <table className="print-grid mb-4 w-full text-sm">
          <thead>
            <tr>
              <th>{t("report.period")}</th>
              <th>{t("stats.receipts")}</th>
              <th>{t("stats.total")}</th>
              {expected > 0 ? <th>{t("due.expected")}</th> : null}
              <th>{t("report.generated")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{periodLabel}</td>
              <td className="tabular-nums">{receipts.length}</td>
              <td className="font-bold tabular-nums">{formatAmount(total)}</td>
              {expected > 0 ? (
                <td className="tabular-nums">{formatAmount(expected)}</td>
              ) : null}
              <td>{formatDateTime(new Date().toISOString(), locale)}</td>
            </tr>
          </tbody>
        </table>

        {sections.length === 0 ? (
          <p className="print-grid p-6 text-center text-sm">
            {t("period.empty")}
          </p>
        ) : null}

        {sections.map((section) => (
          <section key={section.key} className="mb-4 break-inside-auto">
            {/* The heading is what makes the split readable on paper; with a
                single status selected it still names which one this is. */}
            <h2 className="mb-1.5 text-sm font-bold tracking-wide uppercase">
              {section.label}
              <span className="ml-2 font-normal tabular-nums">
                {t("chart.receiptsCount", { count: section.rows.length })} ·{" "}
                {formatAmount(sum(section.rows))}
              </span>
            </h2>

            {/* At sm and up, and always on paper, the real grid. */}
            <table className="print-grid hidden w-full text-sm sm:table print:table">
              <thead>
                <tr>
                  <th>{t("slip.number")}</th>
                  <th>{t("table.donor")}</th>
                  <th>{t("table.mobile")}</th>
                  <th>{t("table.method")}</th>
                  <th>{t("table.date")}</th>
                  {section.key === "Unpaid" ? <th>{t("form.dueOn")}</th> : null}
                  <th className="text-right">{t("table.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums">{r.receipt_number}</td>
                    <td>{r.donor_name}</td>
                    <td className="tabular-nums">{r.phone_number}</td>
                    <td>{t(`method.${r.payment_method}`)}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(r.collection_date, locale)}
                    </td>
                    {section.key === "Unpaid" ? (
                      <td className="whitespace-nowrap">
                        {r.due_on ? formatDate(r.due_on, locale) : "—"}
                      </td>
                    ) : null}
                    <td className="text-right tabular-nums">
                      {formatAmount(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={section.key === "Unpaid" ? 6 : 5}>
                    {section.key === "Unpaid"
                      ? t("due.expected")
                      : t("report.grandTotal")}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatAmount(sum(section.rows))}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* On a phone, one card per receipt. Six columns cannot fit 360px,
                and a report you have to scroll sideways to see the amount in is
                not a report you can check. */}
            <div className="flex flex-col gap-2 sm:hidden print:hidden">
              {section.rows.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="wrap-anywhere font-medium">
                      {r.donor_name}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatAmount(r.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    #{r.receipt_number} · {r.phone_number} ·{" "}
                    {t(`method.${r.payment_method}`)} ·{" "}
                    {formatDate(r.collection_date, locale)}
                    {r.due_on
                      ? ` · ${t("form.dueOn")} ${formatDate(r.due_on, locale)}`
                      : ""}
                  </p>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t-2 pt-2 font-bold">
                <span>
                  {section.key === "Unpaid"
                    ? t("due.expected")
                    : t("report.grandTotal")}
                </span>
                <span className="tabular-nums">
                  {formatAmount(sum(section.rows))}
                </span>
              </div>
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
