"use client";

import * as React from "react";
import { ViewTransition } from "react";

import type { Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePulseOnChange } from "@/lib/use-pulse-on-change";

/** `all`, or one of the two payment statuses. */
export const STATUS_FILTERS = ["all", "Paid", "Unpaid"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const LABEL_KEYS = {
  all: "status.all",
  Paid: "status.paidOnly",
  Unpaid: "status.unpaidOnly",
} as const;

export function filterByStatus<T extends Pick<Receipt, "payment_status">>(
  receipts: T[],
  status: StatusFilter,
): T[] {
  if (status === "all") return receipts;
  return receipts.filter((r) => r.payment_status === status);
}

/** Received / unpaid, in the same segmented style as the period filter. */
export function StatusFilterBar({
  status,
  onChange,
  unpaidCount,
}: {
  status: StatusFilter;
  onChange: (status: StatusFilter) => void;
  /** Shown on the Unpaid tab so the count is visible before switching. */
  unpaidCount?: number;
}) {
  const { t } = useI18n();
  // The tally drops when anyone marks a pledge paid, here or on another
  // volunteer's phone. One beat says so; see use-pulse-on-change.
  const pulse = usePulseOnChange(unpaidCount ?? 0);
  // One pill travelling between the chips rather than two fills swapping. The
  // reasoning, and why the name is scoped with useId, is on PeriodPresets.
  const markerName = `status-chip-${React.useId()}`;

  return (
    <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:w-fit sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
      {STATUS_FILTERS.map((key) => {
        const selected = status === key;
        return (
        <Button
          key={key}
          size="sm"
          variant="outline"
          /* The chosen chip keeps its solid `secondary` fill — a pane that
             also reads as "selected" needs something the other panes do not
             have, and translucency is the wrong axis for it. Only the
             unselected chips are glass.
             Height is not set here: @media (pointer: coarse) in globals.css
             puts a 44px floor under every button on a phone, so this stays
             the desktop density. */
          className={cn(
            "glass-pill relative shrink-0 rounded-full sm:border-transparent sm:shadow-none",
            selected && "text-secondary-foreground",
          )}
          onClick={() => React.startTransition(() => onChange(key))}
        >
          {selected ? (
            <ViewTransition name={markerName} share="chip-marker" default="none">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-secondary"
              />
            </ViewTransition>
          ) : null}
          <span className="relative">{t(LABEL_KEYS[key])}</span>
          {key === "Unpaid" && unpaidCount ? (
            <span className={cn("ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums", pulse)}>
              {unpaidCount}
            </span>
          ) : null}
        </Button>
        );
      })}
    </div>
  );
}
