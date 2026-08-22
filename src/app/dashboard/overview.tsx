"use client";

import * as React from "react";
import {
  CalendarDays,
  IndianRupee,
  Receipt as ReceiptIcon,
  Users,
} from "lucide-react";
import type { Receipt } from "@/lib/types";
import { formatAmount } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyCollections } from "./daily-collections";
import { filterByPeriod, PeriodFilter, type Period } from "./period-filter";

export function Overview({ receipts }: { receipts: Receipt[] }) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);

  const visible = React.useMemo(
    () => filterByPeriod(receipts, period),
    [receipts, period],
  );

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
    </div>
  );
}
