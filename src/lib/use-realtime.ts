"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export type RealtimeStatus = "connecting" | "live" | "polling";

/**
 * The tables whose changes should reach every device.
 *
 * The audit tables are here because an edit that changes nothing else still
 * writes an audit row, and the activity feed is a view of them. Publication
 * membership for all six is what supabase/17-realtime-complete.sql guarantees.
 */
const TABLES = [
  "receipts",
  "receipt_audit",
  "expenses",
  "expense_audit",
  // 11-donation-box.sql publishes these so a donation logged on one phone
  // shows on another; without them here it never did.
  "donations",
  "donation_audit",
] as const;

/*
 * Safety-net refresh cadence, in ms.
 *
 * Even "live" gets a net, but a slack one: every tick is a full
 * router.refresh() on mobile data, and a missing table fails its channel
 * loudly rather than going quiet (see the per-table note below). What is left
 * for the net is what stays invisible — a blocked websocket, a socket dropped
 * on a phone, an event lost in a reconnect gap.
 */
const POLL_LIVE = 600_000;
// Realtime is not working; this is the only thing keeping the page current, so
// it is the one case worth paying for often.
const POLL_FALLBACK = 30_000;

/**
 * Keeps every volunteer's view current.
 *
 * Realtime is the fast path but can fail — a blocked websocket, a dropped
 * socket. A visibility-triggered and interval refresh backs it up, so the
 * worst case is seconds late rather than "until you reload".
 */
export function useRealtimeReceipts(delay = 400) {
  const router = useRouter();
  const [status, setStatus] = React.useState<RealtimeStatus>("connecting");

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    /** Tears down the channel and auth listener, once they exist. */
    let closeSocket: (() => void) | undefined;

    const refreshSoon = () => {
      clearTimeout(timer);
      // Debounced, so a volunteer saving three receipts in a row costs one
      // refresh rather than three. router.refresh() re-runs the server
      // components and streams fresh data in without dropping local state
      // (open dialogs, filters, scroll). Clearing only the route on screen is
      // enough now that no page segment is cached: every other tab refetches
      // when it is tapped anyway.
      timer = setTimeout(() => router.refresh(), delay);
    };

    void (async () => {
      // Imported here so @supabase/supabase-js — 65 KB gzipped — stays off
      // the critical path of every dashboard route. Nothing on screen needs it
      // to paint: the dot starts at "connecting", which is what it should read.
      const { createClient } = await import("@/lib/supabase/client");
      if (disposed) return;
      const supabase = createClient();

      /*
       * One channel PER TABLE, not one with six bindings — a resilience fix.
       * realtime-js matches bindings against the server's BY INDEX and kills
       * the whole channel with CHANNEL_ERROR on the first mismatch, so one
       * table missing from the publication took live updates down for all six.
       * They share the one websocket, so this is six handshakes, not six
       * connections.
       */
      const channels = TABLES.map((table) =>
        supabase.channel(`pp-${table}`).on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          refreshSoon,
        ),
      );

      // Keep the socket authorised across token refreshes.
      const { data: authSub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session?.access_token) {
            void supabase.realtime.setAuth(session.access_token);
          }
        },
      );

      // Registered before the first await below, so an unmount that lands
      // mid-handshake still has something to tear down.
      closeSocket = () => {
        authSub.subscription.unsubscribe();
        for (const channel of channels) void supabase.removeChannel(channel);
      };
      if (disposed) {
        closeSocket();
        return;
      }

      // Realtime needs the access token explicitly: RLS is enforced on the
      // socket, and without this the subscription is silently unauthorised.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      /*
       * Per-channel, so a rejected table is reported BY NAME. Status stays
       * "live" only while all six are subscribed — one dead binding does need
       * the faster poll, the difference being that the other five still
       * deliver instantly.
       */
      const failed = new Set<string>();
      const subscribed = new Set<string>();

      channels.forEach((channel, i) => {
        const table = TABLES[i];
        channel.subscribe((state, err) => {
          if (disposed) return;

          if (state === "SUBSCRIBED") {
            subscribed.add(table);
            failed.delete(table);
            if (failed.size === 0 && subscribed.size === TABLES.length) {
              setStatus("live");
            }
            return;
          }

          if (
            state === "CHANNEL_ERROR" ||
            state === "TIMED_OUT" ||
            state === "CLOSED"
          ) {
            subscribed.delete(table);
            // Once per table, or a channel that retries logs on every attempt.
            if (!failed.has(table)) {
              failed.add(table);
              // `err` is the only thing that names the cause — for a rejected
              // binding the server says why. And the message names the TABLE:
              // pointing at one migration when another was unrun sent a real
              // diagnosis the wrong way.
              console.warn(
                `[realtime] ${state} on "${table}" — that table's changes ` +
                  "will arrive by periodic refresh instead. If this persists, " +
                  "run supabase/17-realtime-complete.sql, then the " +
                  "'realtime publication' query in supabase/verify.sql to " +
                  "confirm.",
                err ?? "(no error detail from the server)",
              );
            }
            setStatus("polling");
          }
        });
      });
    })();

    // Coming back to the tab is the most common moment to be out of date.
    // Registered synchronously: these only debounce a refresh, so they work
    // whether or not the Supabase client has finished loading.
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
      closeSocket?.();
    };
  }, [router, delay]);

  // Interval safety net, paused while the tab is hidden so a phone in a pocket
  // is not refreshing all evening.
  //
  // ONE interval, re-armed by `status`. An earlier version drove it from a
  // second interval that recreated this one every POLL_FALLBACK, so a
  // POLL_LIVE period could never elapse and the net silently stopped firing.
  React.useEffect(() => {
    const interval = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        // No navigator.onLine guard: it reports offline on connections that
        // are working (a VPN settling, wifi handing over), and skipping the
        // refresh then means the ledger silently stops updating. A refresh
        // that cannot reach the server just fails, which costs nothing.
        router.refresh();
      },
      status === "live" ? POLL_LIVE : POLL_FALLBACK,
    );

    return () => clearInterval(interval);
  }, [router, status]);

  return status;
}
