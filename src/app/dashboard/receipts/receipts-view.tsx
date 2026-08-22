"use client";

import * as React from "react";
import type { Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptsTable } from "../receipts-table";
import { filterByPeriod, PeriodFilter, type Period } from "../period-filter";

export function ReceiptsView({
  receipts,
  mandalName,
}: {
  receipts: Receipt[];
  mandalName: string;
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);

  const visible = React.useMemo(
    () => filterByPeriod(receipts, period),
    [receipts, period],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t("table.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("table.subtitle")}</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

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
