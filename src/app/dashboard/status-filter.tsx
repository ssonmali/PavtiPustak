"use client";

import type { Receipt } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:w-fit sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
      {STATUS_FILTERS.map((key) => (
        <Button
          key={key}
          size="sm"
          variant={status === key ? "secondary" : "outline"}
          /* The chosen chip keeps its solid `secondary` fill — a pane that
             also reads as "selected" needs something the other panes do not
             have, and translucency is the wrong axis for it. Only the
             unselected chips are glass.
             Height is not set here: @media (pointer: coarse) in globals.css
             puts a 44px floor under every button on a phone, so this stays
             the desktop density. */
          className={cn(
            "shrink-0 rounded-full sm:border-transparent sm:shadow-none",
            status !== key && "glass-pill",
          )}
          onClick={() => onChange(key)}
        >
          {t(LABEL_KEYS[key])}
          {key === "Unpaid" && unpaidCount ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
              {unpaidCount}
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}
