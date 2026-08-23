"use client";

import * as React from "react";
import { BarChart3, CalendarRange, Table2, TrendingUp } from "lucide-react";
import type { DailyTotal } from "@/lib/types";
import {
  formatAmount,
  formatDate,
  formatDateShort,
} from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DailyCollections({ days }: { days: DailyTotal[] }) {
  const { t, locale } = useI18n();
  const [asTable, setAsTable] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);

  // Rows arrive pre-aggregated and pre-filtered from the dashboard.
  const max = Math.max(...days.map((d) => Number(d.total)), 1);
  const grand = days.reduce((sum, d) => sum + Number(d.total), 0);
  const busiest = days.reduce<DailyTotal | null>(
    (best, d) => (!best || Number(d.total) > Number(best.total) ? d : best),
    null,
  );

  const tick = (iso: string) => formatDateShort(iso, locale);

  return (
    <div className="viz-root flex flex-col gap-4">
      {/* Literal hexes, not theme tokens: this exact pair was validated for
          colourblind separation and WCAG contrast against both card surfaces.
          Swapping in brand colours would break that guarantee. */}
      <style>{`
        .viz-root {
          --series-cash: #2a78d6;
          --series-upi: #eb6834;
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
                <TableRow key={d.collection_date}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(d.collection_date, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(d.cash) ? formatAmount(d.cash) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(d.upi) ? formatAmount(d.upi) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(d.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {d.receipt_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div style={{ maxWidth: days.length * 68 }}>
          <p className="sr-only">
            {t("chart.title")} — {formatAmount(grand)}
          </p>
          <div
            className="flex h-44 items-end gap-2 sm:h-56 sm:gap-3"
            // Tapping the gaps between bars dismisses an open readout.
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setActive(null);
            }}
          >
            {days.map((d, index) => {
              const h = (Number(d.total) / max) * 100;
              // Stack UPI above Cash; percentages are of this bar's own height.
              const upiShare = Number(d.total)
                ? (Number(d.upi) / Number(d.total)) * 100
                : 0;
              const shown = active === d.collection_date;
              const toggle = () =>
                setActive((current) =>
                  current === d.collection_date ? null : d.collection_date,
                );

              return (
                <div
                  key={d.collection_date}
                  role="button"
                  tabIndex={0}
                  aria-label={`${formatDate(d.collection_date, locale)}: ${formatAmount(d.total)}, ${t("method.Cash")} ${formatAmount(d.cash)}, ${t("method.UPI")} ${formatAmount(d.upi)}, ${t("chart.receiptsCount", { count: d.receipt_count })}`}
                  // A mouse gets hover, and nothing on click: the readout is
                  // already open, so toggling would close it under the cursor.
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setActive(d.collection_date);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") setActive(null);
                  }}
                  // Touch and pen toggle instead. Deliberately not onClick or
                  // onFocus: a tap fires focus first, so the click would land
                  // on an already-open readout and close it again.
                  onPointerUp={(e) => {
                    if (e.pointerType !== "mouse") toggle();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle();
                    }
                  }}
                  data-active={shown || undefined}
                  className="group relative flex h-full min-w-5 flex-1 cursor-pointer flex-col justify-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-foreground/[0.06] sm:min-w-7"
                >
                  <div
                    className="relative w-full overflow-hidden rounded-t-md"
                    style={{ height: `${Math.max(h, 1.5)}%` }}
                  >
                    {Number(d.upi) > 0 ? (
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${upiShare}%`,
                          background: "var(--series-upi)",
                          // 2px surface gap between stacked segments.
                          marginBottom: Number(d.cash) > 0 ? 2 : 0,
                        }}
                      />
                    ) : null}
                    {Number(d.cash) > 0 ? (
                      <div
                        className={Number(d.upi) > 0 ? "w-full" : "w-full rounded-t"}
                        style={{
                          height: `calc(${100 - upiShare}% - ${Number(d.upi) > 0 ? 2 : 0}px)`,
                          background: "var(--series-cash)",
                        }}
                      />
                    ) : null}
                  </div>

                  {/*
                   * The readout has to stay inside the plot box: the scrolling
                   * wrapper computes overflow-y to auto, so anything above the
                   * bars is clipped and unreachable.
                   *
                   * `bottom-full` cannot be used for "above the bar" — the
                   * column is full height, so that means above the whole plot,
                   * which is what used to hide the readout for every bar. It
                   * sits above the bar's own top when there is room for it
                   * there, and overlays the top of the plot when there is not.
                   * Horizontally it pins to whichever edge it would overflow.
                   */}
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute z-20 w-max rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md",
                      shown ? "block" : "hidden",
                      index === 0
                        ? "left-0"
                        : index === days.length - 1
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                    style={
                      // 45% leaves roughly the readout's own height above the
                      // bar; past that there is no room and it moves inside.
                      h < 45 ? { bottom: `calc(${h}% + 4px)` } : { top: 4 }
                    }
                  >
                    <p className="font-medium">{formatDate(d.collection_date, locale)}</p>
                    <p className="tabular-nums">{formatAmount(d.total)}</p>
                    <p className="text-muted-foreground">
                      {t("chart.receiptsCount", { count: d.receipt_count })}
                    </p>
                    {Number(d.cash) > 0 ? (
                      <p className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: "var(--series-cash)" }}
                        />
                        {t("method.Cash")} {formatAmount(d.cash)}
                      </p>
                    ) : null}
                    {Number(d.upi) > 0 ? (
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
          {/* Per-bar ticks need ~40px each to be legible, which phones do not
              have. Below sm the axis collapses to the range instead of showing
              a row of truncated ellipses. */}
          <p className="mt-1.5 border-t pt-1.5 text-center text-[11px] text-muted-foreground sm:hidden">
            {t("chart.range", {
              from: tick(days[0].collection_date),
              to: tick(days[days.length - 1].collection_date),
            })}
          </p>

          <div className="mt-1.5 hidden gap-2 border-t pt-1.5 sm:flex sm:gap-3">
            {days.map((d, i) => {
              // One tick per ~6 bars keeps labels legible at phone width.
              const every = Math.ceil(days.length / 6);
              return (
                <div
                  key={d.collection_date}
                  className="min-w-5 flex-1 truncate text-center text-[10px] text-muted-foreground sm:min-w-7"
                >
                  {i % every === 0 || i === days.length - 1 ? tick(d.collection_date) : ""}
                </div>
              );
            })}
          </div>
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
            {t("chart.busiestDay")}: {formatDate(busiest.collection_date, locale)} ·{" "}
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
