"use client";

import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** Today / Last 7 days / All time — the quick-pick row, on its own. */
export function PeriodPresets({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const { t } = useI18n();

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
    </div>
  );
}

/**
 * The custom-range fields as a plain inline row rather than a popover — it
 * used to live behind a pill the same size as "Today"/"Last 7 days", which
 * made a two-field date range look squeezed. Placed wherever there is room
 * (below a search/sort bar, or under the presets on pages without one).
 */
export function CustomDateRange({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const { t } = useI18n();

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

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
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
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
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
      </div>
    </div>
  );
}

/**
 * Convenience composition for pages with no search/sort bar to tuck the
 * custom range under — the presets and the range fields stacked together.
 */
export function PeriodFilter({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <PeriodPresets period={period} onChange={onChange} />
      <CustomDateRange period={period} onChange={onChange} />
    </div>
  );
}
