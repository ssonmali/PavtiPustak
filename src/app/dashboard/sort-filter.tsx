"use client";

import { ArrowDownUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
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
} as const;

/** Sits beside the search box on the receipts and expenses ledgers. */
export function SortFilter({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
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
        title={t(LABEL_KEYS[value] ?? "sort.newest")}
        className="w-auto shrink-0 px-2.5"
      >
        <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" />
        {/* Rendered for screen readers only — sighted users get the icon. */}
        <SelectValue className="sr-only">
          {(v) => t(LABEL_KEYS[v as SortKey] ?? "sort.newest")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SORT_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {t(LABEL_KEYS[key])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
