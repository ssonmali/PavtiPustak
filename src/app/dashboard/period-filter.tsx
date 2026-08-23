"use client";

import { CalendarRange } from "lucide-react";
import { formatDate } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ALL_TIME,
  LAST_7,
  PRESETS,
  samePeriod,
  TODAY,
  type Period,
} from "./period";

export * from "./period";

function presetLabelKey(period: Period) {
  if (samePeriod(period, TODAY)) return "period.today" as const;
  if (samePeriod(period, LAST_7)) return "period.7" as const;
  return "period.all" as const;
}

export function PeriodFilter({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const { t, locale } = useI18n();

  const custom = period.kind === "custom" ? period : null;
  const from = custom?.from ?? "";
  const to = custom?.to ?? "";

  /**
   * Applied as each date is picked rather than behind an Apply button: a range
   * with only a start is a legitimate question ("since the 5th"), so there is
   * nothing to wait for.
   */
  function setBound(edge: "from" | "to", value: string) {
    const next = {
      kind: "custom" as const,
      from: edge === "from" ? value || null : from || null,
      to: edge === "to" ? value || null : to || null,
    };
    // Clearing both is the whole ledger again, not an empty custom range.
    onChange(next.from || next.to ? next : ALL_TIME);
  }

  const customLabel = () => {
    if (!custom || (!custom.from && !custom.to)) return t("period.custom");
    const left = custom.from ? formatDate(custom.from, locale) : "…";
    const right = custom.to ? formatDate(custom.to, locale) : "…";
    return `${left} — ${right}`;
  };

  return (
    <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
      {PRESETS.map((preset) => (
        <Button
          key={presetLabelKey(preset)}
          size="sm"
          variant={samePeriod(period, preset) ? "secondary" : "outline"}
          className="shrink-0 sm:border-transparent sm:shadow-none"
          onClick={() => onChange(preset)}
        >
          {t(presetLabelKey(preset))}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant={custom ? "secondary" : "outline"}
              className="shrink-0 sm:border-transparent sm:shadow-none"
              title={t("period.custom")}
            />
          }
        >
          <CalendarRange />
          <span className="max-w-40 truncate">{customLabel()}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          {/* Native date inputs, matching the print report's range fields, so a
              phone gets its own picker rather than a calendar built here. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-from" className="text-xs text-muted-foreground">
              {t("report.from")}
            </Label>
            <Input
              id="period-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setBound("from", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-to" className="text-xs text-muted-foreground">
              {t("report.to")}
            </Label>
            <Input
              id="period-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setBound("to", e.target.value)}
            />
          </div>
          {custom ? (
            <Button size="sm" variant="outline" onClick={() => onChange(ALL_TIME)}>
              {t("period.clear")}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
