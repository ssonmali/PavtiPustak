"use client";

import { useOffline } from "next/offline";
import { CloudOff } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * Server Actions survive a connectivity drop with experimental.useOffline, but
 * a pending save is indistinguishable from a slow one — this says which it is.
 */
export function OfflineBadge() {
  const isOffline = useOffline();
  const { t } = useI18n();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-14 z-20 flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200 print:hidden"
    >
      <CloudOff className="size-3.5 shrink-0" />
      {t("offline.badge")}
    </div>
  );
}
