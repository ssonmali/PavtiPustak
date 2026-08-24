import { createClient } from "@/lib/supabase/server";
import type { Donation, Expense, Receipt } from "@/lib/types";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  isPartPaid,
  outstanding,
  received,
  type Money,
} from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { ReportToolbar } from "./report-toolbar";
import {
  parseRange,
  parseSort,
  parseStatus,
  type ReportRange,
} from "./report-range";
import { sortRows } from "../sort-rows";
import { splitLedger } from "./split-ledger";

export const metadata = { title: "Report · SGMM Pustak" };

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
  const sort = parseSort(params);

  const supabase = await createClient();
  const { locale, t } = await getDictionary();
  const mandalName = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal";

  let query = supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: true })
    .order("receipt_number", { ascending: true })
    .limit(MAX_ROWS);
  if (range.from) query = query.gte("collection_date", range.from);
  if (range.to) query = query.lte("collection_date", range.to);

  let donationQuery = supabase
    .from("donations")
    .select("*")
    .order("donation_date", { ascending: true })
    .order("donation_number", { ascending: true })
    .limit(MAX_ROWS);
  if (range.from) donationQuery = donationQuery.gte("donation_date", range.from);
  if (range.to) donationQuery = donationQuery.lte("donation_date", range.to);

  let expenseQuery = supabase
    .from("expenses")
    .select("*")
    .order("spent_on", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (range.from) expenseQuery = expenseQuery.gte("spent_on", range.from);
  if (range.to) expenseQuery = expenseQuery.lte("spent_on", range.to);

  const [{ data }, { data: donationData }, { data: expenseData }] =
    await Promise.all([query, donationQuery, expenseQuery]);
  // Sorted here rather than in the query so the same order applies to both
  // ledgers and to the Excel export, which takes these arrays as they are.
  const all: Receipt[] = sortRows(
    (data ?? []) as Receipt[],
    sort,
    {
      date: (r) => r.collection_date,
      amount: (r) => r.amount,
      name: (r) => r.donor_name,
      number: (r) => r.receipt_number,
    },
    locale,
  );
  // Additive: an unrun migration 11 should not break the rest of the report.
  const allDonations: Donation[] = donationData ?? [];
  // No `number` accessor: an expense has no serial, so the receipt-number
  // orders fall back to the default rather than pretending to sort.
  const allExpenses: Expense[] = sortRows(
    (expenseData ?? []) as Expense[],
    sort,
    {
      date: (e) => e.spent_on,
      amount: (e) => e.amount,
      name: (e) => e.description,
    },
    locale,
  );

  // Money in the box and money still owed, not face amounts: a part-paid row
  // has already contributed some of its amount, so summing `amount` on both
  // sides of the report would print the same rupees twice.
  const sum = (rows: Money[]) => rows.reduce((n, r) => n + received(r), 0);
  const sumOutstanding = (rows: Money[]) =>
    rows.reduce((n, r) => n + outstanding(r), 0);
  const total = sum(all);

  /**
   * Printed as two sections rather than one mixed list: on paper a column of
   * amounts that silently includes money nobody paid cannot be reconciled.
   *
   * Split on the two halves, not on payment_status: a part-paid contribution
   * belongs in both — its received half under Received, its remainder under
   * Unpaid — and its name carries a tag on each so the same contributor
   * appearing twice reads as one split rather than a duplicate. Splitting on
   * status instead left the received half out of the Received section while
   * the summary total counted it, so the sections did not add up to the figure
   * printed above them.
   */
  const { settled: paid, open: unpaid } = splitLedger(all);
  const { settled: expensesPaid, open: expensesOwed } = splitLedger(allExpenses);
  const spent = sum(allExpenses);
  const expected = sumOutstanding(unpaid);
  const owed = sumOutstanding(allExpenses);

  // What the Excel export and the row cap notice count. Donations are kept
  // out of this figure — they are a different entity, exported and printed
  // as their own section, never merged into a receipts count or total.
  const receipts =
    status === "all"
      ? all
      : status === "Paid"
        ? paid
        : status === "Unpaid"
          ? unpaid
          : [];
  const donations =
    status === "all" || status === "Donation" ? allDonations : [];
  const expenses =
    status === "all" || status === "Expense" ? allExpenses : [];

  const periodLabel = rangeLabel(range, locale, t("period.all"));

  /**
   * One printable row, whichever ledger it came from, so the four sections are
   * drawn by one table rather than four near-identical ones.
   */
  type PrintRow = {
    id: string;
    /** Receipt number; expenses have none, so the column is left blank. */
    number: number | null;
    /** Donor name or description, already carrying its split tag. */
    title: string;
    /** Phone number for a receipt, category for an expense. */
    second: string;
    /** Payment method on a settled row, the date it is expected on an open one. */
    third: string;
    date: string;
    amount: number;
  };

  /** The tag that says why one name appears in both sections of a report. */
  const tag = (name: string, partial: boolean, suffix: string) =>
    partial ? `${name} ${suffix}` : name;

  const receiptRow = (r: Receipt, section: "Paid" | "Unpaid"): PrintRow => ({
    id: r.id,
    number: r.receipt_number,
    title: tag(r.donor_name, isPartPaid(r), t("report.partialTag")),
    second: r.phone_number,
    third:
      section === "Unpaid"
        ? r.due_on
          ? formatDate(r.due_on, locale)
          : "—"
        : t(`method.${r.payment_method}`),
    date: formatDate(r.collection_date, locale),
    amount: section === "Unpaid" ? outstanding(r) : received(r),
  });

  const expenseRow = (e: Expense, section: "Paid" | "Unpaid"): PrintRow => ({
    id: e.id,
    number: null,
    title: tag(
      e.description,
      isPartPaid(e),
      section === "Unpaid" ? t("report.toPayTag") : t("report.advanceTag"),
    ),
    second: t(`category.${e.category}`),
    third:
      section === "Unpaid"
        ? e.due_on
          ? formatDate(e.due_on, locale)
          : "—"
        : t(`method.${e.payment_method}`),
    date: formatDate(e.spent_on, locale),
    amount: section === "Unpaid" ? outstanding(e) : received(e),
  });

  const receiptHead = {
    number: t("slip.number"),
    title: t("table.donor"),
    second: t("table.mobile"),
  };
  const expenseHead = {
    number: "",
    title: t("expenses.description"),
    second: t("expenses.category"),
  };

  const sections = [
    {
      key: "Paid" as const,
      /** Whether this section lists money still owed rather than money moved. */
      open: false,
      label: t("status.paidOnly"),
      head: receiptHead,
      rows: paid.map((r) => receiptRow(r, "Paid")),
      totalLabel: t("report.grandTotal"),
    },
    {
      key: "Unpaid" as const,
      open: true,
      label: t("status.unpaidOnly"),
      head: receiptHead,
      rows: unpaid.map((r) => receiptRow(r, "Unpaid")),
      totalLabel: t("due.expected"),
    },
    {
      key: "Expense" as const,
      open: false,
      label: t("report.expensesPaid"),
      head: expenseHead,
      rows: expensesPaid.map((e) => expenseRow(e, "Paid")),
      totalLabel: t("expenses.total"),
    },
    {
      key: "Expense" as const,
      open: true,
      label: t("report.expensesOwed"),
      head: expenseHead,
      rows: expensesOwed.map((e) => expenseRow(e, "Unpaid")),
      totalLabel: t("expenses.owed"),
    },
  ]
    .filter((s) =>
      status === "all"
        ? s.rows.length > 0
        : s.key === status && s.rows.length > 0,
    )
    // Footed with the sum of what is printed in the column, so the figure can
    // be checked against the rows above it by adding them up.
    .map((s) => ({
      ...s,
      total: s.rows.reduce((n, r) => n + r.amount, 0),
    }));

  /**
   * The summary describes what is actually printed. A money column for a
   * status the report excludes would sit next to a row count that does not
   * include it — the collected total beside a count of unpaid receipts.
   */
  const summary = [
    { label: t("report.period"), value: periodLabel },
    // On the Donation report there are no receipts to count, so the row names
    // what is actually on the page rather than reporting a truthful zero.
    status === "Donation"
      ? {
          label: t("donation.title"),
          value: String(donations.length),
          num: true,
        }
      : status === "Expense"
        ? {
            label: t("expenses.title"),
            value: String(expenses.length),
            num: true,
          }
        : {
            label: t("stats.receipts"),
            value: String(receipts.length),
            num: true,
          },
    // Donation is excluded from both money rows for the same reason Unpaid is
    // excluded from the collected total: this report prints no receipts at all,
    // so a rupee figure here would sit beside "Receipts: 0" and describe rows
    // that are not on the page.
    ...(status === "Unpaid" || status === "Donation" || status === "Expense"
      ? []
      : [
          {
            label: t("stats.total"),
            value: formatAmount(total),
            num: true,
            strong: true,
          },
        ]),
    ...(status !== "Paid" &&
    status !== "Donation" &&
    status !== "Expense" &&
    expected > 0
      ? [{ label: t("due.expected"), value: formatAmount(expected), num: true }]
      : []),
    // Spending gets its own two cells rather than being netted off the
    // collected figure: a report is checked by adding a column up, and a
    // single "balance" cell cannot be checked against anything on the page.
    ...(expenses.length > 0
      ? [
          {
            label: t("expenses.total"),
            value: formatAmount(spent),
            num: true,
            strong: status === "Expense",
          },
        ]
      : []),
    ...(expenses.length > 0 && owed > 0
      ? [{ label: t("expenses.owed"), value: formatAmount(owed), num: true }]
      : []),
    {
      label: t("report.generated"),
      value: formatDateTime(new Date().toISOString(), locale),
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-none">
      <ReportToolbar
        range={range}
        status={status}
        sort={sort}
        labels={{
          statusAll: t("status.all"),
          statusPaid: t("status.paidOnly"),
          statusUnpaid: t("status.unpaidOnly"),
          statusDonation: t("donation.badge"),
          statusExpense: t("expenses.title"),
          today: t("period.today"),
          all: t("period.all"),
          from: t("report.from"),
          to: t("report.to"),
          export: t("report.export"),
          pdf: t("export.pdf"),
          excel: t("export.excel"),
          back: t("report.back"),
        }}
        receipts={receipts}
        donations={donations}
        expenses={expenses}
        mandalName={mandalName}
      />

      {receipts.length === MAX_ROWS || donations.length === MAX_ROWS ? (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm print:hidden">
          {t("report.limit", { count: MAX_ROWS })}
        </p>
      ) : null}

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
              {summary.map((cell) => (
                <th key={cell.label}>{cell.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {summary.map((cell) => (
                <td
                  key={cell.label}
                  className={cn(
                    cell.num && "tabular-nums",
                    cell.strong && "font-bold",
                  )}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {sections.length === 0 && donations.length === 0 ? (
          <p className="print-grid p-6 text-center text-sm">
            {t("period.empty")}
          </p>
        ) : null}

        {sections.map((section) => (
          <section
            key={section.label}
            className="mb-4 break-inside-auto"
          >
            {/* The heading is what makes the split readable on paper; with a
                single status selected it still names which one this is. */}
            <h2 className="mb-1.5 text-sm font-bold tracking-wide uppercase">
              {section.label}
              <span className="ml-2 font-normal tabular-nums">
                {t("chart.receiptsCount", { count: section.rows.length })} ·{" "}
                {formatAmount(section.total)}
              </span>
            </h2>

            {/* At sm and up, and always on paper, the real grid. */}
            <table className="print-grid hidden w-full text-sm sm:table print:table">
              <thead>
                <tr>
                  <th>{section.head.number}</th>
                  <th>{section.head.title}</th>
                  <th>{section.head.second}</th>
                  <th>
                    {section.open ? t("form.dueOn") : t("table.method")}
                  </th>
                  <th>{t("table.date")}</th>
                  <th className="text-right">{t("table.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums">{r.number ?? ""}</td>
                    <td>{r.title}</td>
                    <td className="tabular-nums">{r.second}</td>
                    <td className="whitespace-nowrap">{r.third}</td>
                    <td className="whitespace-nowrap">{r.date}</td>
                    <td className="text-right tabular-nums">
                      {formatAmount(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>{section.totalLabel}</td>
                  <td className="text-right tabular-nums">
                    {formatAmount(section.total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* On a phone, one card per row. Six columns cannot fit 360px, and
                a report you have to scroll sideways to see the amount in is not
                a report you can check. */}
            <div className="flex flex-col gap-2 sm:hidden print:hidden">
              {section.rows.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="wrap-anywhere font-medium">{r.title}</span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatAmount(r.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.number != null ? `#${r.number} · ` : ""}
                    {r.second} · {r.third} · {r.date}
                  </p>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t-2 pt-2 font-bold">
                <span>{section.totalLabel}</span>
                <span className="tabular-nums">
                  {formatAmount(section.total)}
                </span>
              </div>
            </div>
          </section>
        ))}

        {donations.length > 0 ? (
          <section className="mb-4 break-inside-auto">
            {/* No grand total here: `value` is optional and often blank, so a
                summed figure would silently understate what was actually
                given — the count is the only thing this section can claim. */}
            <h2 className="mb-1.5 text-sm font-bold tracking-wide uppercase">
              {t("donation.title")}
              <span className="ml-2 font-normal tabular-nums">
                {t("chart.receiptsCount", { count: donations.length })}
              </span>
            </h2>

            <table className="print-grid hidden w-full text-sm sm:table print:table">
              <thead>
                <tr>
                  <th>{t("donation.number")}</th>
                  <th>{t("donation.donor")}</th>
                  <th>{t("table.mobile")}</th>
                  <th>{t("donation.item")}</th>
                  <th>{t("donation.date")}</th>
                  <th className="text-right">{t("donation.value")}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="tabular-nums">{d.donation_number}</td>
                    <td>{d.donor_name}</td>
                    <td className="tabular-nums">{d.phone_number ?? "—"}</td>
                    <td>{d.item}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(d.donation_date, locale)}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.value != null ? formatAmount(d.value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col gap-2 sm:hidden print:hidden">
              {donations.map((d) => (
                <div key={d.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="wrap-anywhere font-medium">
                      {d.donor_name}
                    </span>
                    {d.value != null ? (
                      <span className="shrink-0 font-bold tabular-nums">
                        {formatAmount(d.value)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    #{d.donation_number}
                    {d.phone_number ? ` · ${d.phone_number}` : ""} · {d.item} ·{" "}
                    {formatDate(d.donation_date, locale)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}
