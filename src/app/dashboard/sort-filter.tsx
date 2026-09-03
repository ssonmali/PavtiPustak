"use client";

import { ArrowDownUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_KEYS, type SortKey } from "./sort-rows";

const LABEL_KEYS = {
  "date-desc": "sort.newest",
  "date-asc": "sort.oldest",
  "amount-desc": "sort.amountHigh",
  "amount-asc": "sort.amountLow",
  "name-asc": "sort.az",
  "number-asc": "sort.numberAsc",
  "number-desc": "sort.numberDesc",
} as const;

/** Sits beside the search box on the receipts and expenses ledgers. */
export function SortFilter({
  value,
  onChange,
  keys = SORT_KEYS,
  disabled = false,
  className,
  showLabel = false,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
  /** Sorting is a database query, so it is unavailable with no connection. */
  disabled?: boolean;
  /**
   * Which orders to offer. Defaults to all of them; the expenses ledger passes
   * a narrower list because its rows carry no receipt number.
   */
  keys?: readonly SortKey[];
  /** Extra classes for the trigger, so a caller can give it the glass pill. */
  className?: string;
  /**
   * Show the chosen order as text rather than icon-only.
   *
   * Off beside the search box, where the icon is what keeps this from wrapping
   * onto its own line. On inside the filter sheet, which has a full row for it
   * and where an unlabelled icon under a "Sort by" heading would be the one
   * control in there that does not say what it is currently doing.
   */
  showLabel?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as SortKey)}
      // Base UI's Select is controlled; there is no hidden input to mirror
      // because this never submits.
    >
      {/* Icon-only: sits beside the search box at any width rather than
          wrapping below it. The chosen sort still reads as full text once
          the dropdown is open. */}
      <SelectTrigger
        aria-label={t("sort.label")}
        title={
          disabled ? t("table.needsSignal") : t(LABEL_KEYS[value] ?? "sort.newest")
        }
        className={cn(
          showLabel ? "w-full justify-between" : "w-auto shrink-0 px-2.5",
          className,
        )}
        disabled={disabled}
      >
        <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" />
        {/* Icon-only by default, so this is for screen readers; with showLabel
            the same text is what sighted users read too. */}
        <SelectValue className={showLabel ? undefined : "sr-only"}>
          {(v) => t(LABEL_KEYS[v as SortKey] ?? "sort.newest")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {keys.map((key) => (
          <SelectItem key={key} value={key}>
            {t(LABEL_KEYS[key])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
