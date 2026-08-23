"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { useOfflineReceipts, type FlushResult } from "@/lib/offline";
import { useEditingPresence } from "@/lib/use-editing-presence";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineBadge } from "@/components/offline-badge";
import { ReceiptsTable, type ReceiptsTableHandle } from "../receipts-table";
import { filterByPeriod, PeriodFilter, type Period } from "../period-filter";
import {
  filterByStatus,
  StatusFilterBar,
  type StatusFilter,
} from "../status-filter";

export function ReceiptsView({
  receipts,
  mandalName,
  total,
  myName,
}: {
  receipts: Receipt[];
  mandalName: string;
  total: number;
  /** This volunteer's display name, published to the other editors. */
  myName: string;
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(0);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const { editors, setEditing: setPresence } = useEditingPresence(myName);

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

  const inPeriod = React.useMemo(
    () => filterByPeriod(local, period),
    [local, period],
  );

  const visible = React.useMemo(
    () => filterByStatus(inPeriod, status),
    [inPeriod, status],
  );

  const tableRef = React.useRef<ReceiptsTableHandle>(null);

  // Counted within the period, so the badge matches what switching would show.
  const unpaidCount = React.useMemo(
    () => inPeriod.filter((r) => r.payment_status === "Unpaid").length,
    [inPeriod],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("table.title")}
            </h1>
            <Button size="sm" onClick={() => tableRef.current?.openCreate()}>
              <Plus /> {t("table.new")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {online ? t("table.subtitle") : t("offline.showingSaved")}
          </p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

      <StatusFilterBar
        status={status}
        onChange={setStatus}
        unpaidCount={unpaidCount}
      />

      <OfflineBadge online={online} pending={pending} syncing={syncing} />

      <Card className="card-elevated">
        <CardContent>
          <ReceiptsTable
            receipts={visible}
            mandalName={mandalName}
            // Pagination only makes sense against the live server list, and
            // only when nothing is filtered out of it client-side.
            total={online && status === "all" ? total : undefined}
            online={online}
            queue={queue}
            editors={editors}
            setPresence={setPresence}
            ref={tableRef}
          />
        </CardContent>
      </Card>
    </div>
  );
}
