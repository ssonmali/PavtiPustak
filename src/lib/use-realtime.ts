"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "live" | "polling";

/** Safety-net refresh cadence, in ms. */
// Even "live" gets a safety net: update and delete events depend on the
// table's replica identity being full, which is server configuration this code
// cannot verify. But when realtime IS working it is the mechanism, and every
// tick here costs a full router.refresh() — the layout's queries plus the
// page's, on a volunteer's mobile data — so the net is deliberately slack.
const POLL_LIVE = 120_000;
// Realtime is not working; this is the only thing keeping the page current, so
// it is the one case worth paying for often.
const POLL_FALLBACK = 30_000;

/**
 * Keeps every volunteer's view current.
 *
 * Realtime is the fast path, but it can fail quietly — the table may not be in
 * the publication, a corporate network may block websockets, or the socket may
 * drop on a phone. So a visibility-triggered and interval refresh backs it up:
 * worst case updates are seconds late, never "until you reload".
 */
export function useRealtimeReceipts(delay = 400) {
  const router = useRouter();
  const [status, setStatus] = React.useState<RealtimeStatus>("connecting");

  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const refreshSoon = () => {
      clearTimeout(timer);
      // router.refresh() re-runs the server components and streams fresh data
      // in without dropping local state (open dialogs, filters, scroll).
      timer = setTimeout(() => router.refresh(), delay);
    };

    const channel = supabase
      .channel("receipts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "receipts" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "receipt_audit" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_audit" },
        refreshSoon,
      )
      // 11-donation-box.sql puts these in the publication so a donation logged
      // on one phone shows on another; without them here it never did.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donation_audit" },
        refreshSoon,
      );

    void (async () => {
      // Realtime needs the access token explicitly: RLS is enforced on the
      // socket, and without this the subscription is silently unauthorised.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel.subscribe((state) => {
        if (disposed) return;
        if (state === "SUBSCRIBED") {
          setStatus("live");
          return;
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          // Falls back to polling rather than going stale.
          console.warn(
            `[realtime] ${state} — falling back to periodic refresh. ` +
              "If this persists, check that supabase/03-realtime.sql has run.",
          );
          setStatus("polling");
        }
      });
    })();

    // Keep the socket authorised across token refreshes.
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });

    // Coming back to the tab is the most common moment to be out of date.
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refreshSoon);

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refreshSoon);
      authSub.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [router, delay]);

  // Interval safety net, paused while the tab is hidden so a phone in a pocket
  // is not refreshing all evening.
  //
  // One interval, re-armed by `status` changing. The previous version drove
  // this from a second `retune` interval that cleared and recreated the first
  // one every POLL_FALLBACK — which meant a POLL_LIVE interval was always
  // destroyed before its longer period could ever elapse, so once realtime
  // reported healthy the safety net silently stopped firing altogether.
  React.useEffect(() => {
    const interval = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        if (!navigator.onLine) return;
        router.refresh();
      },
      status === "live" ? POLL_LIVE : POLL_FALLBACK,
    );

    return () => clearInterval(interval);
  }, [router, status]);

  return status;
}
