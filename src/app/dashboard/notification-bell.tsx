"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/receipt-utils";
import type { Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The bell, not the Receipts tab, is where "something needs collecting today"
 * lives — it is visible from every page, and unlike a nav badge it can name
 * who without navigating anywhere first.
 */
/** Only what the bell renders, so the query can select just these columns. */
type DueRow = Pick<Receipt, "id" | "donor_name" | "amount">;

export function NotificationBell({ dueToday }: { dueToday: DueRow[] }) {
  const { t } = useI18n();
  const count = dueToday.length;
  // Controlled so the popover closes on navigation — Link doesn't unmount
  // the trigger the way a real page load would, so it stays open otherwise.
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label={t("bell.title")}
          />
        }
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1 py-px text-[9px] leading-none font-semibold text-primary-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="px-1 pt-0.5 text-sm font-medium">{t("bell.title")}</p>
        {count === 0 ? (
          <p className="px-1 pb-0.5 text-sm text-muted-foreground">
            {t("bell.none")}
          </p>
        ) : (
          <>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {dueToday.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-2 rounded-md px-1 py-1 text-sm"
                >
                  <span className="wrap-anywhere min-w-0">{r.donor_name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatAmount(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/receipts" />}
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t("bell.viewAll")}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
