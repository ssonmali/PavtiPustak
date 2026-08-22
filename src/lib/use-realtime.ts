"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the current route whenever any volunteer changes a receipt, so
 * two people collecting side by side never see different totals.
 *
 * Bursts are coalesced: entering five receipts quickly should cost one refresh,
 * not five.
 */
export type RealtimeStatus = "connecting" | "live" | "off";

export function useRealtimeReceipts(delay = 400) {
  const router = useRouter();
  const [status, setStatus] = React.useState<RealtimeStatus>("connecting");

  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel("receipts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "receipts" },
        () => {
          clearTimeout(timer);
          // router.refresh() re-runs the server components and streams fresh
          // data in without dropping local state (open dialogs, filters).
          timer = setTimeout(() => router.refresh(), delay);
        },
      )
      .subscribe((state) => {
        setStatus(state === "SUBSCRIBED" ? "live" : state === "CLOSED" ? "off" : "connecting");
      });

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, delay]);

  return status;
}
