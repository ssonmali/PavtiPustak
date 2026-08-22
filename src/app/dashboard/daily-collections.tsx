"use client";

import * as React from "react";
import { BarChart3, CalendarRange, Table2, TrendingUp } from "lucide-react";
import type { Receipt } from "@/lib/types";
import { formatAmount, formatDate } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DayTotal = {
  date: string;
  cash: number;
  upi: number;
  total: number;
  count: number;
};

function aggregate(receipts: Receipt[]): DayTotal[] {
  const byDate = new Map<string, DayTotal>();

  for (const r of receipts) {
    const day =
      byDate.get(r.collection_date) ??
      { date: r.collection_date, cash: 0, upi: 0, total: 0, count: 0 };
    const amount = Number(r.amount);
    if (r.payment_method === "UPI") day.upi += amount;
    else day.cash += amount;
    day.total += amount;
    day.count += 1;
    byDate.set(r.collection_date, day);
  }

  // Oldest → newest so the bars read left-to-right as time.
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function DailyCollections({ receipts }: { receipts: Receipt[] }) {
  const { t, locale } = useI18n();
  const [asTable, setAsTable] = React.useState(false);

  // The period filter lives on the dashboard; receipts arrive pre-filtered.
  const days = React.useMemo(() => aggregate(receipts), [receipts]);
  const max = Math.max(...days.map((d) => d.total), 1);
  const grand = days.reduce((s, d) => s + d.total, 0);
  const busiest = days.reduce<DayTotal | null>(
    (best, d) => (!best || d.total > best.total ? d : best),
    null,
  );

  /** Short axis tick: `22 Aug` / `२२ ऑग`. */
  const tick = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(
      locale === "mr" ? "mr-IN" : "en-IN",
      { day: "numeric", month: "short" },
    );
  };

  return (
    <div className="viz-root flex flex-col gap-4">
      <style>{`
        .viz-root {
          --series-cash: #2a78d6;
          --series-upi: #eb6834;
          --viz-surface: var(--color-card);
        }
        .dark .viz-root {
          --series-cash: #3987e5;
          --series-upi: #d95926;
        }
      `}</style>

      <div className="flex items-center">
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? <BarChart3 /> : <Table2 />}
          {asTable ? t("chart.showChart") : t("chart.showTable")}
        </Button>
      </div>

      {days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("chart.empty")}
        </p>
      ) : asTable ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead className="text-right">{t("method.Cash")}</TableHead>
                <TableHead className="text-right">{t("method.UPI")}</TableHead>
                <TableHead className="text-right">{t("stats.total")}</TableHead>
                <TableHead className="text-right">{t("stats.receipts")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...days].reverse().map((d) => (
                <TableRow key={d.date}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(d.date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.cash ? formatAmount(d.cash) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.upi ? formatAmount(d.upi) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(d.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {d.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div
            className="flex h-40 min-w-full items-end gap-1.5 sm:h-50 sm:gap-2"
            role="img"
            aria-label={`${t("chart.title")} — ${formatAmount(grand)}`}
          >
            {days.map((d) => {
              const h = (d.total / max) * 100;
              // Stack UPI above Cash; percentages are of this bar's own height.
              const upiShare = d.total ? (d.upi / d.total) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="group relative flex h-full min-w-6 flex-1 flex-col justify-end sm:min-w-8"
                >
                  <div
                    className="relative w-full overflow-hidden rounded-t"
                    style={{ height: `${Math.max(h, 1.5)}%` }}
                  >
                    {d.upi > 0 ? (
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${upiShare}%`,
                          background: "var(--series-upi)",
                          // 2px surface gap between stacked segments.
                          marginBottom: d.cash > 0 ? 2 : 0,
                        }}
                      />
                    ) : null}
                    {d.cash > 0 ? (
                      <div
                        className={d.upi > 0 ? "w-full" : "w-full rounded-t"}
                        style={{
                          height: `calc(${100 - upiShare}% - ${d.upi > 0 ? 2 : 0}px)`,
                          background: "var(--series-cash)",
                        }}
                      />
                    ) : null}
                  </div>

                  {/* Hover tooltip — hit target is the whole column. */}
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max -translate-x-1/2 rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md group-hover:block"
                    role="tooltip"
                  >
                    <p className="font-medium">{formatDate(d.date)}</p>
                    <p className="tabular-nums">{formatAmount(d.total)}</p>
                    <p className="text-muted-foreground">
                      {t("chart.receiptsCount", { count: d.count })}
                    </p>
                    {d.cash > 0 ? (
                      <p className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: "var(--series-cash)" }}
                        />
                        {t("method.Cash")} {formatAmount(d.cash)}
                      </p>
                    ) : null}
                    {d.upi > 0 ? (
                      <p className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: "var(--series-upi)" }}
                        />
                        {t("method.UPI")} {formatAmount(d.upi)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Axis ticks: thinned so labels never collide. */}
          <div className="mt-1.5 flex min-w-full gap-1.5 border-t pt-1.5 sm:gap-2">
            {days.map((d, i) => {
              // One tick per ~6 bars keeps labels legible at phone width.
              const every = Math.ceil(days.length / 6);
              return (
                <div
                  key={d.date}
                  className="min-w-6 flex-1 truncate text-center text-[10px] text-muted-foreground sm:min-w-8"
                >
                  {i % every === 0 || i === days.length - 1 ? tick(d.date) : ""}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend — identity is never colour-alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {(
          [
            ["method.Cash", "var(--series-cash)"],
            ["method.UPI", "var(--series-upi)"],
          ] as const
        ).map(([key, color]) => (
          <span key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: color }}
              aria-hidden
            />
            {t(key)}
          </span>
        ))}

        {busiest ? (
          <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="size-3.5" />
            {t("chart.busiestDay")}: {formatDate(busiest.date)} ·{" "}
            <span className="tabular-nums">{formatAmount(busiest.total)}</span>
          </span>
        ) : null}
        {days.length > 0 ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarRange className="size-3.5" />
            {t("chart.dailyAverage")}:{" "}
            <span className="tabular-nums">
              {formatAmount(grand / days.length)}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
