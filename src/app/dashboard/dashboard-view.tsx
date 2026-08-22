"use client";

import * as React from "react";
import { CalendarDays, IndianRupee, Receipt as ReceiptIcon, Users } from "lucide-react";
import type { Receipt } from "@/lib/types";
import { formatAmount, toDateValue } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyCollections } from "./daily-collections";
import { ReceiptsTable } from "./receipts-table";

/** 0 = all time; otherwise the number of days back, inclusive of today. */
const PERIODS = [1, 7, 30, 0] as const;
export type Period = (typeof PERIODS)[number];

const PERIOD_KEYS = {
  1: "period.today",
  7: "period.7",
  30: "period.30",
  0: "period.all",
} as const;

/** Earliest `YYYY-MM-DD` included in the period, on the local calendar. */
function startOf(period: Period) {
  if (period === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - (period - 1));
  return toDateValue(d);
}

export function DashboardView({
  receipts,
  mandalName,
}: {
  receipts: Receipt[];
  mandalName: string;
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);

  const visible = React.useMemo(() => {
    const from = startOf(period);
    if (!from) return receipts;
    return receipts.filter((r) => r.collection_date >= from);
  }, [receipts, period]);

  const total = visible.reduce((sum, r) => sum + Number(r.amount), 0);
  const donors = new Set(visible.map((r) => r.donor_name.trim().toLowerCase()));

  const stats = [
    { label: t("stats.total"), value: formatAmount(total), icon: IndianRupee },
    {
      label: t("stats.receipts"),
      value: String(visible.length),
      icon: ReceiptIcon,
    },
    { label: t("stats.donors"), value: String(donors.size), icon: Users },
    {
      label: t("stats.avgReceipt"),
      value: visible.length ? formatAmount(total / visible.length) : "—",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t("table.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("table.subtitle")}</p>
        </div>

        {/* One period filter drives the stats, the chart, the table and export. */}
        <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "secondary" : "outline"}
              className="shrink-0 sm:border-transparent sm:shadow-none"
              onClick={() => setPeriod(p)}
            >
              {t(PERIOD_KEYS[p])}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* A single day has nothing to plot across dates. */}
      {period !== 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("chart.title")}</CardTitle>
            <CardDescription>{t("chart.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyCollections receipts={visible} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <ReceiptsTable
            receipts={visible}
            mandalName={mandalName}
            periodDays={period}
          />
        </CardContent>
      </Card>
    </div>
  );
}
