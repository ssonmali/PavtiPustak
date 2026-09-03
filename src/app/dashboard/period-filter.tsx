"use client";

import * as React from "react";

import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALL_TIME,
  periodLabelKey,
  PRESETS,
  samePeriod,
  type Period,
} from "./period";

export * from "./period";

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
          key={periodLabelKey(preset)}
          size="sm"
          variant={samePeriod(period, preset) ? "secondary" : "outline"}
          /* The `outline` variant is bg-background, which is the opaque mesh
             base — so these chips sat on the glass as flat panels. Only the
             unselected ones become glass: the chosen chip keeps its solid
             `secondary` fill, because "selected" needs a cue the others do
             not have and translucency is the wrong axis to say it with.
             Height is not set here: @media (pointer: coarse) in globals.css
             puts a 44px floor under every button on a phone, so this stays
             the desktop density. */
          className={cn(
            "shrink-0 rounded-full sm:border-transparent sm:shadow-none",
            !samePeriod(period, preset) && "glass-pill",
          )}
          onClick={() => onChange(preset)}
        >
          {t(periodLabelKey(preset))}
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
  /**
   * Per-instance ids rather than the fixed "period-from"/"period-to" these
   * had. Since the filter sheet went in, two copies of this box are in the
   * document at once on a phone — the inline one the tabs render from `sm` up,
   * and the sheet's — and duplicate ids point every <label> at whichever came
   * first, so tapping the label in the sheet focused the hidden field behind
   * it. Invisible on desktop; the whole control on a phone.
   */
  const id = React.useId();
  const fromId = `${id}-from`;
  const toId = `${id}-to`;

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
    /* Was a bare bordered box: no ground of its own, so it read as a flat
       cut-out rather than part of the same material. */
    <div className="glass-inset flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <Label htmlFor={fromId} className="text-xs text-muted-foreground">
            {t("report.from")}
          </Label>
          <Input
            id={fromId}
            type="date"
            /* No glass-pill here: the from/to box around these already IS
               the glass, and a pill stacked inside it compounds two veils
               into a near-white patch — which is what made this box look
               painted on. A visible border is enough now that --input is a
               real hairline rather than a white one.
               No height set either: [data-slot="input"] gets the same 44px
               floor from @media (pointer: coarse). */
            value={from}
            max={to || undefined}
            onChange={(e) => setBound("from", e.target.value)}
          />
        </div>
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <Label htmlFor={toId} className="text-xs text-muted-foreground">
            {t("report.to")}
          </Label>
          <Input
            id={toId}
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
