"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/receipt-utils";
import type { ExpenseCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CategoryTotal } from "./category-totals";

/**
 * The reason the categories exist: what the mandal actually spent its money on.
 * Doubles as the filter, so the same rows that answer "how much on prasad"
 * also answer "which ones were they" — a breakdown you cannot open is a
 * readout, and the picker was the missing half.
 */
export function CategoryBreakdown({
  rows,
  selected,
  onSelect,
}: {
  /** Totals for the visible period, already aggregated. */
  rows: CategoryTotal[];
  selected: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory | null) => void;
}) {
  const { t } = useI18n();

  if (rows.length === 0) return null;

  // The share is of everything spent in the period, so the bars still compare
  // against the whole even while one category is selected.
  const total = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle>{t("expenses.byCategory")}</CardTitle>
        <CardDescription>{t("expenses.byCategoryHint")}</CardDescription>
        {selected ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-1 w-fit"
            onClick={() => onSelect(null)}
          >
            {t("expenses.allCategories")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const share = total ? Math.round((row.total / total) * 100) : 0;
            const active = selected === row.category;
            return (
              <li key={row.category}>
                {/* A button, not a row with a click handler: this is a filter
                    toggle, so it must be reachable and announce its state. */}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : row.category)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {t(`category.${row.category}`)}
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(row.total)}
                    </span>
                    {/* Not muted while selected: against the stronger fill
                        the muted ink falls to 3.9:1, under the 4.5:1 small
                        text needs. */}
                    <span
                      className={cn(
                        "w-10 text-right text-xs tabular-nums",
                        active ? "text-accent-foreground" : "text-muted-foreground",
                      )}
                    >
                      {share}%
                    </span>
                  </span>
                  <span className="block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        active ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                      style={{ width: `${share}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
