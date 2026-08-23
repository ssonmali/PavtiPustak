"use client";

import * as React from "react";
import {
  Clock,
  IndianRupee,
  Sigma,
  Receipt as ReceiptIcon,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type {
  DailyTotal,
  ExpenseDailyTotal,
  NameMap,
  PledgeTotals,
  Receipt,
  VolunteerTotal,
} from "@/lib/types";
import { displayName, formatAmount } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyCollections } from "./daily-collections";
import { DuePanel } from "./due-panel";
import {
  filterByPeriod,
  PeriodFilter,
  startOf,
  type Period,
} from "./period-filter";

export function Overview({
  daily,
  volunteers,
  expenseDays,
  pledges,
  unpaidDays,
  due,
  mandalName,
  names,
}: {
  daily: DailyTotal[];
  volunteers: VolunteerTotal[];
  expenseDays: ExpenseDailyTotal[];
  pledges: PledgeTotals | null;
  /** Unpaid receipt amounts with the date they were recorded. */
  unpaidDays: { amount: number; collection_date: string }[];
  due: Receipt[];
  mandalName: string;
  names: NameMap;
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);

  const visible = React.useMemo(() => {
    const from = startOf(period);
    const rows = from
      ? daily.filter((d) => d.collection_date >= from)
      : daily;
    // Oldest → newest so the chart reads left-to-right as time.
    return [...rows].sort((a, b) =>
      a.collection_date.localeCompare(b.collection_date),
    );
  }, [daily, period]);

  const total = visible.reduce((s, d) => s + Number(d.total), 0);
  const count = visible.reduce((s, d) => s + d.receipt_count, 0);

  // Spending over the same window, so the balance answers "of what came in
  // during this period, what is left" rather than mixing two date ranges.
  const spent = React.useMemo(
    () =>
      filterByPeriod(
        expenseDays.map((e) => ({ ...e, collection_date: e.spent_on })),
        period,
      ).reduce((sum, e) => sum + Number(e.total), 0),
    [expenseDays, period],
  );

  const balance = total - spent;

  // Over the same window as everything else on the page, and keyed on the date
  // the contribution was recorded rather than when it is expected — so it lines
  // up with the collected figure beside it.
  const unpaid = React.useMemo(
    () =>
      filterByPeriod(unpaidDays, period).reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      ),
    [unpaidDays, period],
  );
  const unpaidCount = React.useMemo(
    () => filterByPeriod(unpaidDays, period).length,
    [unpaidDays, period],
  );

  /**
   * Each money figure wears the colour of its state, so the row can be read
   * before it is read: a projection, cash in hand, money still owed. The
   * receipt count stays uncoloured — it is a tally, not an amount, and giving
   * it a fourth hue would mean colour no longer tracked the state of money.
   */
  const stats = [
    {
      // Everything recorded, received or not — what the mandal is counting on.
      label: t("stats.estimated"),
      value: formatAmount(total + unpaid),
      icon: Sigma,
      tone: "info" as const,
    },
    {
      label: t("stats.total"),
      value: formatAmount(total),
      icon: IndianRupee,
      tone: "positive" as const,
    },
    { label: t("stats.receipts"), value: String(count), icon: ReceiptIcon },
    {
      label: t("stats.unpaid"),
      value: formatAmount(unpaid),
      icon: Clock,
      tone: "pending" as const,
      hint: unpaidCount
        ? t("chart.receiptsCount", { count: unpaidCount })
        : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
            {t("nav.overview")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("table.subtitle")}</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

      <DuePanel pledges={due} mandalName={mandalName} />

      {/* Collected less spent. Shown even at zero spend so the figure is a
          fixture of the dashboard rather than something that appears once the
          first expense is recorded. */}
      <Card
        className={cn(
          "card-elevated accent-top",
          balance < 0
            ? "[--accent-line:var(--destructive)]"
            : "[--accent-line:var(--positive)]",
        )}
      >
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                balance < 0
                  ? "bg-destructive/12 text-destructive"
                  : "bg-positive/12 text-positive",
              )}
            >
              <Wallet className="size-3.5" />
            </span>
            {t("balance.title")}
          </CardDescription>
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums sm:text-4xl",
              // A negative balance is a real state — the mandal has committed
              // more than it has taken in — so it is called out, not hidden.
              balance < 0 && "text-destructive",
            )}
          >
            {formatAmount(balance)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {balance < 0 ? (
              <span className="flex items-center gap-1.5 text-destructive">
                <TriangleAlert className="size-3.5 shrink-0" />
                {t("balance.overspent")}
              </span>
            ) : (
              t("balance.subtitle")
            )}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">
                {t("balance.collected")}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatAmount(total)}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{t("balance.spent")}</dt>
              <dd className="font-medium tabular-nums">
                &minus;{formatAmount(spent)}
              </dd>
            </div>
            {pledges && Number(pledges.expected) > 0 ? (
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">{t("due.expected")}</dt>
                <dd className="font-medium tabular-nums text-muted-foreground">
                  {formatAmount(pledges.expected)}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone, hint }) => (
          <Card
            key={label}
            className={cn(
              "card-elevated accent-top",
              tone === "info" && "[--accent-line:var(--info)]",
              tone === "positive" && "[--accent-line:var(--positive)]",
              tone === "pending" && "[--accent-line:var(--pending)]",
            )}
          >
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                {/* The label sits beside the swatch, so the colour is a second
                    reading of the state and never the only one. */}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    tone === "info" && "bg-info/12 text-info",
                    tone === "positive" && "bg-positive/12 text-positive",
                    tone === "pending" && "bg-pending/15 text-pending",
                    !tone && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {label}
              </CardDescription>
              {/* The figure stays in ink. These hues are picked to be told
                  apart as marks, and none of them clears 4.5:1 as text in
                  both themes. */}
              <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
                {value}
              </CardTitle>
              {hint ? (
                <CardDescription className="tabular-nums">
                  {hint}
                </CardDescription>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>

      {period !== 1 ? (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>{t("chart.title")}</CardTitle>
            <CardDescription>{t("chart.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyCollections days={visible} />
          </CardContent>
        </Card>
      ) : null}

      {volunteers.length > 0 ? (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>{t("volunteers.title")}</CardTitle>
            <CardDescription>{t("volunteers.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {volunteers.map((v) => {
                const share = total
                  ? Math.round((Number(v.total) / total) * 100)
                  : 0;
                return (
                  <li key={v.volunteer} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="wrap-anywhere min-w-0 flex-1 truncate">
                        {displayName(v.volunteer, names)}
                      </span>
                      <span className="tabular-nums">
                        {formatAmount(v.total)}
                      </span>
                      <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                        {t("chart.receiptsCount", { count: v.receipt_count })}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[image:var(--brand-gradient)]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
