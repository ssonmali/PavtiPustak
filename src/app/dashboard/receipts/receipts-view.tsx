"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { useOfflineReceipts, type FlushResult } from "@/lib/offline";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineBadge } from "@/components/offline-badge";
import { ReceiptsTable } from "../receipts-table";
import { filterByPeriod, PeriodFilter, type Period } from "../period-filter";

export function ReceiptsView({
  receipts,
  mandalName,
  total,
}: {
  receipts: Receipt[];
  mandalName: string;
  total: number;
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);

  const onFlush = React.useCallback(
    (result: FlushResult) => {
      if (result.synced > 0) {
        toast.success(t("offline.synced", { count: result.synced }));
      }
      if (result.conflicts > 0) {
        toast.error(
          t("offline.conflictsDropped", { count: result.conflicts }),
        );
      }
      if (result.failed > 0) {
        toast.error(t("offline.failed", { count: result.failed }));
      }
    },
    [t],
  );

  const { online, syncing, pending, receipts: local, queue } =
    useOfflineReceipts({ serverRows: receipts, onFlush });

  const visible = React.useMemo(
    () => filterByPeriod(local, period),
    [local, period],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
            {t("table.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {online ? t("table.subtitle") : t("offline.showingSaved")}
          </p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

      <OfflineBadge online={online} pending={pending} syncing={syncing} />

      <Card className="card-elevated">
        <CardContent>
          <ReceiptsTable
            receipts={visible}
            mandalName={mandalName}
            // Pagination only makes sense against the live server list.
            total={online ? total : undefined}
            online={online}
            queue={queue}
          />
        </CardContent>
      </Card>
    </div>
  );
}
