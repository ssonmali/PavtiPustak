"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * Shown when the device is offline or still has queued writes, so "saved on
 * this device" is never mistaken for "saved to the ledger".
 */
export function OfflineBadge({
  online,
  pending,
  syncing,
}: {
  online: boolean;
  pending: number;
  syncing: boolean;
}) {
  const { t } = useI18n();

  if (online && pending === 0) return null;

  const label = !online
    ? t("offline.badge")
    : syncing
      ? t("offline.syncing")
      : t("offline.pendingCount", { count: pending });

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/15 px-3 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200 print:hidden"
    >
      {online ? (
        <RefreshCw className={`size-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`} />
      ) : (
        <CloudOff className="size-3.5 shrink-0" />
      )}
      {label}
    </div>
  );
}
