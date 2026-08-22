"use client";

import * as React from "react";
import type { Receipt } from "@/lib/types";
import { toDateValue } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

/** 0 = all time; otherwise days back, inclusive of today. */
export const PERIODS = [1, 7, 30, 0] as const;
export type Period = (typeof PERIODS)[number];

const PERIOD_KEYS = {
  1: "period.today",
  7: "period.7",
  30: "period.30",
  0: "period.all",
} as const;

/** Earliest `YYYY-MM-DD` in the period, on the local calendar. */
export function startOf(period: Period) {
  if (period === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - (period - 1));
  return toDateValue(d);
}

export function filterByPeriod(receipts: Receipt[], period: Period) {
  const from = startOf(period);
  if (!from) return receipts;
  return receipts.filter((r) => r.collection_date >= from);
}

export function PeriodFilter({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
      {PERIODS.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={period === p ? "secondary" : "outline"}
          className="shrink-0 sm:border-transparent sm:shadow-none"
          onClick={() => onChange(p)}
        >
          {t(PERIOD_KEYS[p])}
        </Button>
      ))}
    </div>
  );
}
