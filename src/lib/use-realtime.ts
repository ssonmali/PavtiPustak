"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export type RealtimeStatus = "connecting" | "live" | "polling";

/** Safety-net refresh cadence, in ms. */
// Even "live" gets a safety net, but a very slack one. Every tick costs a full
// router.refresh() — the layout's queries plus the page's — on a volunteer's
// mobile data, and when realtime is healthy it has nothing to find: the events
// it exists to backstop are the update/delete ones that need `replica identity
// full`, and all six subscribed tables set it.
//
// This used to say the net was there for a table missing from the publication,
// "where the channel reports SUBSCRIBED and simply never delivers". That is
// not how realtime-js 2.x behaves and the correction matters, because it sent
// a real diagnosis the wrong way: _updatePostgresBindings matches the client's
// bindings against the server's BY INDEX, and on any mismatch it unsubscribes
// and fires CHANNEL_ERROR. A table missing from the publication therefore
// fails the whole channel, loudly, and lands in the handler below. What is
// left for this net is what stays genuinely invisible: a blocked websocket, a
// socket dropped on a phone, or an event lost in a reconnect gap. Ten minutes
// bounds that without putting a refresh in the middle of someone's typing;
// returning to the tab refreshes anyway, which is when staleness is noticed.
const POLL_LIVE = 600_000;
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
      // Imported here rather than at module scope so @supabase/supabase-js —
      // 65 KB gzipped — stays out of the dashboard layout's entry chunk, and
      // therefore off the critical path of every dashboard route. Nothing on
      // screen needs it to paint: the status dot starts at "connecting", which
      // is exactly what it should read while this loads.
      const { createClient } = await import("@/lib/supabase/client");
      if (disposed) return;
      const supabase = createClient();

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
        // 11-donation-box.sql puts these in the publication so a donation
        // logged on one phone shows on another; without them here it never did.
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
        void supabase.removeChannel(channel);
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

      channel.subscribe((state, err) => {
        if (disposed) return;
        if (state === "SUBSCRIBED") {
          setStatus("live");
          return;
        }
        if (
          state === "CHANNEL_ERROR" ||
          state === "TIMED_OUT" ||
          state === "CLOSED"
        ) {
          /*
           * Falls back to polling rather than going stale.
           *
           * `err` is passed on because it is the only thing here that names
           * the cause — for a rejected binding the server says which table
           * and why. This callback took only the state and dropped it, which
           * left the message below as the sole clue.
           *
           * And that message named 03-realtime.sql alone, which was actively
           * misleading: with 11 unrun you would check 03, find it correct,
           * and be no wiser. The question is never "did 03 run" but "which of
           * the six bindings was rejected" — see the note on POLL_LIVE for why
           * one is enough to fail them all, and verify.sql for the answer.
           */
          console.warn(
            `[realtime] ${state} — falling back to periodic refresh. ` +
              "If this persists, run the 'realtime publication' query in " +
              "supabase/verify.sql: this channel binds receipts, " +
              "receipt_audit, expenses, expense_audit, donations and " +
              "donation_audit, and any one of them missing from the " +
              "publication fails all of them.",
            err ?? "(no error detail from the server)",
          );
          setStatus("polling");
        }
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
  // One interval, re-armed by `status` changing. The previous version drove
  // this from a second `retune` interval that cleared and recreated the first
  // one every POLL_FALLBACK — which meant a POLL_LIVE interval was always
  // destroyed before its longer period could ever elapse, so once realtime
  // reported healthy the safety net silently stopped firing altogether.
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
