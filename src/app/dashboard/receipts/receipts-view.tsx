"use client";

import * as React from "react";
import { toast } from "sonner";
import type { DailyTotal, NameMap, Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import {
  formatAmount,
  outstanding,
} from "@/lib/receipt-utils";
import { useOfflineReceipts, type FlushResult } from "@/lib/offline";
import type { ReceiptQuery } from "../receipts-query";
import { useReceiptQueryNav } from "../use-receipt-query";
import { useEditingPresence } from "@/lib/use-editing-presence";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineBadge } from "@/components/offline-badge";
import { ReceiptsTable, type ReceiptsTableHandle } from "../receipts-table";
import {
  filterByPeriod,
  PeriodPresets,
  type Period,
} from "../period-filter";
import {
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
  query,
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
  /** Every unpaid pledge — enough of each to derive what is still owed. */
  unpaid: Pick<
    Receipt,
    "amount" | "paid_amount" | "payment_status" | "collection_date"
  >[];
  /** The four controls, parsed from the URL by the page. */
  query: ReceiptQuery;
}) {
  const { t } = useI18n();
  // Read from the URL rather than held here. As component state these reset
  // every time the volunteer switched tabs, because navigating unmounts this.
  const period = query.period;
  const status = query.status;
  const onQueryChange = useReceiptQueryNav(query);
  const setPeriod = React.useCallback(
    (next: Period) => onQueryChange({ period: next }),
    [onQueryChange],
  );
  const setStatus = React.useCallback(
    (next: StatusFilter) => onQueryChange({ status: next }),
    [onQueryChange],
  );
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

  /*
   * The rows as the server returned them.
   *
   * These used to be run through filterByPeriod and filterByStatus, which was
   * the bug: `local` is one page, so filtering it meant "unpaid among the
   * newest 50" while the UI implied "unpaid". Both filters are in the query
   * now.
   *
   * The two filterByPeriod calls further down are a different matter and must
   * stay: they narrow `daily` and `unpaid`, which are separate whole-ledger
   * queries feeding the collected and due figures in the heading, not this
   * paginated list.
   */
  const visible = local;

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

  /**
   * What is still owed, and how many pledges owe it. Both come from the unpaid
   * rows rather than the loaded page, for the same reason the collected figures
   * come from the day aggregates.
   */
  const due = React.useMemo(() => {
    const rows = filterByPeriod(unpaid, period);
    return {
      total: rows.reduce((sum, r) => sum + outstanding(r), 0),
      count: rows.length,
    };
  }, [unpaid, period]);


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
            {/* Each tab gets the money its own rows hold, with the count that
                belongs to that money — a collected total beside a count that
                included pledges would put two scopes on one line. On "all"
                the headline is the two added together, broken down after it,
                because that tab is showing both kinds of row at once. */}
            <p className="text-sm text-muted-foreground">
              {status === "Unpaid" ? (
                <>
                  {t("due.expected")}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatAmount(due.total)}
                  </span>{" "}
                  · {t("chart.receiptsCount", { count: due.count })}
                </>
              ) : status === "Paid" ? (
                <>
                  {t("stats.total")}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatAmount(collected.total)}
                  </span>{" "}
                  · {t("chart.receiptsCount", { count: collected.count })}
                </>
              ) : (
                <>
                  {t("stats.grandTotal")}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatAmount(collected.total + due.total)}
                  </span>{" "}
                  ·{" "}
                  {t("stats.receivedShort", {
                    amount: formatAmount(collected.total),
                  })}{" "}
                  · {t("stats.dueShort", { amount: formatAmount(due.total) })}
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
        <PeriodPresets period={period} onChange={setPeriod} />
      </div>

      <StatusFilterBar
        status={status}
        onChange={setStatus}
        unpaidCount={due.count}
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
            // Paging composes with the filters now that the server applies
            // both, so this no longer has to be withheld under a status
            // filter — the count is the count of the filtered result.
            total={online ? total : undefined}
            online={online}
            queue={queue}
            editors={editors}
            setPresence={setPresence}
            period={period}
            onPeriodChange={setPeriod}
            query={query}
            onQueryChange={onQueryChange}
            ref={tableRef}
          />
        </CardContent>
      </Card>
    </div>
  );
}
