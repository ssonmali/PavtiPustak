"use client";

import { useRealtimeReceipts } from "@/lib/use-realtime";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Mounted once in the dashboard header: subscribes to receipt changes and
 * shows whether the device is currently in sync.
 */
export function RealtimeRefresh() {
  const status = useRealtimeReceipts();
  const { t } = useI18n();

  const live = status === "live";
  const label = live ? t("realtime.live") : t("realtime.polling");

  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center print:hidden"
      title={label}
      aria-label={label}
      role="status"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          live
            ? "bg-positive"
            : status === "connecting"
              ? "animate-pulse bg-pending"
              : "bg-muted-foreground/40",
        )}
      />
    </span>
  );
}
