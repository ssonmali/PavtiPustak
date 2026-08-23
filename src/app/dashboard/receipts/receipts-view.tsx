"use client";

import * as React from "react";
import { toast } from "sonner";
import type { DailyTotal, NameMap, Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/receipt-utils";
import { useOfflineReceipts, type FlushResult } from "@/lib/offline";
import { useEditingPresence } from "@/lib/use-editing-presence";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineBadge } from "@/components/offline-badge";
import { ReceiptsTable, type ReceiptsTableHandle } from "../receipts-table";
import {
  ALL_TIME,
  filterByPeriod,
  PeriodFilter,
  type Period,
} from "../period-filter";
import {
  filterByStatus,
  StatusFilterBar,
  type StatusFilter,
} from "../status-filter";

export function ReceiptsView({
  receipts,
  mandalName,
  names,
  total,
  myName,
  daily,
  unpaid,
}: {
  receipts: Receipt[];
  mandalName: string;
  /** Volunteer display names, for the shared receipt image. */
  names: NameMap;
  total: number;
  /** This volunteer's display name, published to the other editors. */
  myName: string;
  /** Per-day paid totals for the whole ledger, for the heading summary. */
  daily: DailyTotal[];
  /** Every unpaid pledge, amount and day only. */
  unpaid: { amount: number; collection_date: string }[];
}) {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<Period>(ALL_TIME);
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

  /**
   * The heading figures come from the day aggregates, not from the rows the
   * table has loaded. Totalling the loaded page would quietly under-report the
   * money as soon as the ledger runs past one page, and a total that looks
   * authoritative is worse than a short list.
   */
  const collected = React.useMemo(() => {
    const days = filterByPeriod(daily, period);
    return {
      total: days.reduce((sum, d) => sum + Number(d.total), 0),
      count: days.reduce((sum, d) => sum + d.receipt_count, 0),
    };
  }, [daily, period]);

  const expected = React.useMemo(
    () =>
      filterByPeriod(unpaid, period).reduce((sum, r) => sum + Number(r.amount), 0),
    [unpaid, period],
  );

  // Counted within the period, so the badge matches what switching would show.
  const unpaidCount = React.useMemo(
    () => inPeriod.filter((r) => r.payment_status === "Unpaid").length,
    [inPeriod],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* The action keeps the top-right corner beside the heading at every
            width, rather than moving between rows as the layout changes. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("table.title")}
            </h1>
            {/* One money figure with the count that belongs to it. Showing the
                collected total beside a count that included pledges would put
                two different scopes on the same line. */}
            <p className="text-sm text-muted-foreground">
              {status === "Unpaid" ? (
                <>
                  {t("due.expected")}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatAmount(expected)}
                  </span>
                </>
              ) : (
                <>
                  {t("stats.total")}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatAmount(collected.total)}
                  </span>{" "}
                  · {t("chart.receiptsCount", { count: collected.count })}
                </>
              )}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => tableRef.current?.openCreate()}
            className="shrink-0"
          >
            <Plus /> {t("table.new")}
          </Button>
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
            names={names}
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
