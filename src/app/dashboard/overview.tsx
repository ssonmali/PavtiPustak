"use client";

import * as React from "react";
import {
  IndianRupee,
  Receipt as ReceiptIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import type { DailyTotal, VolunteerTotal } from "@/lib/types";
import { formatAmount, formatDate } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyCollections } from "./daily-collections";
import { PeriodFilter, startOf, type Period } from "./period-filter";

export function Overview({
  daily,
  volunteers,
}: {
  daily: DailyTotal[];
  volunteers: VolunteerTotal[];
}) {
  const { t, locale } = useI18n();
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
  // Per-day donor counts cannot be summed into a unique total, so this is the
  // busiest single day's donor count — labelled as such rather than implied.
  const busiest = visible.reduce<DailyTotal | null>(
    (best, d) => (!best || Number(d.total) > Number(best.total) ? d : best),
    null,
  );

  const stats = [
    { label: t("stats.total"), value: formatAmount(total), icon: IndianRupee },
    { label: t("stats.receipts"), value: String(count), icon: ReceiptIcon },
    {
      label: t("stats.avgReceipt"),
      value: count ? formatAmount(total / count) : "—",
      icon: TrendingUp,
    },
    {
      label: t("stats.volunteers"),
      value: String(volunteers.length),
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t("nav.overview")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("table.subtitle")}</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <Icon className="size-3.5" /> {label}
              </CardDescription>
              <CardTitle className="text-xl tabular-nums sm:text-2xl">
                {value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {period !== 1 ? (
        <Card>
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
        <Card>
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
                        {v.volunteer}
                      </span>
                      <span className="tabular-nums">
                        {formatAmount(v.total)}
                      </span>
                      <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                        {t("chart.receiptsCount", { count: v.receipt_count })}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
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

      {busiest ? (
        <p className="text-xs text-muted-foreground">
          {t("chart.busiestDay")}: {formatDate(busiest.collection_date, locale)}{" "}
          · {formatAmount(busiest.total)}
        </p>
      ) : null}
    </div>
  );
}
