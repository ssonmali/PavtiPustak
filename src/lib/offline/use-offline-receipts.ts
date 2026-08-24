"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Receipt } from "@/lib/types";
import {
  cacheReceipts,
  enqueue,
  localId as makeLocalId,
  readCachedReceipts,
  readOutbox,
  type OutboxEntry,
} from "./index";
import { mergeOutbox, pickBase, type LocalReceipt } from "./merge";
import { flushOutbox, type FlushResult } from "./sync";

/** How long a reachability probe may take before it counts as a failure. */
const PROBE_TIMEOUT = 4000;
/** How often to re-probe while offline. The `online` event is not reliable. */
const RETRY_MS = 5000;

/**
 * Did a request actually reach the server?
 *
 * AbortController rather than AbortSignal.timeout: this runs on whatever
 * browser a volunteer's phone happens to have, and the older Android WebViews
 * in that population do not have the latter.
 */
async function reachable() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(`/api/health?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the app can actually reach the server.
 *
 * Deliberately not `navigator.onLine` on its own. That flag answers whether the
 * OS thinks an interface is up, and it is wrong often enough to matter — a VPN
 * connecting, wifi handing over to mobile data, a laptop waking — so the app
 * was showing "offline" on a perfectly good connection.
 *
 * The browser's `offline` event is therefore treated as a suspicion and
 * confirmed with a real request before anything is said to the volunteer. The
 * bias is towards "online" on purpose: a false offline stops someone working
 * and pushes their writes into a queue they did not ask for, while a false
 * online costs one failed request that every write path already handles by
 * queueing.
 */
export function useOnline() {
  // Assume online during SSR and the first paint, so the markup matches.
  const [online, setOnline] = React.useState(true);
  /**
   * The same value for the listeners to read. Depending on `online` in the
   * effect instead would tear the whole subscription down on every change —
   * including the retry timer that had just been armed, which left the banner
   * up for good on exactly the devices whose `online` event never arrives.
   */
  const onlineRef = React.useRef(true);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;

    const check = async () => {
      // One probe at a time: the events below can arrive in a burst as an
      // interface settles, and each would otherwise start its own request.
      if (cancelled || checking) return;
      checking = true;
      const ok = await reachable();
      checking = false;
      if (cancelled) return;

      onlineRef.current = ok;
      setOnline(ok);
      clearTimeout(timer);
      // Keep looking while it is down. Waiting for the `online` event alone
      // left the banner up after the connection came back on any device that
      // never fired it.
      if (!ok) timer = setTimeout(() => void check(), RETRY_MS);
    };

    const onVisible = () => {
      // Only when there is something to find out: a phone coming out of a
      // pocket is the usual moment to have missed an event, but probing on
      // every tab switch would be a request for nothing.
      if (
        document.visibilityState === "visible" &&
        (!navigator.onLine || !onlineRef.current)
      ) {
        void check();
      }
    };

    const onEvent = () => void check();
    window.addEventListener("online", onEvent);
    window.addEventListener("offline", onEvent);
    document.addEventListener("visibilitychange", onVisible);

    // On mount, only when the browser claims there is no connection: if it
    // says there is, believe it and spend no request on confirming.
    if (!navigator.onLine) void check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", onEvent);
      window.removeEventListener("offline", onEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return online;
}

type Options = {
  /** Rows rendered by the server; empty when the request never landed. */
  serverRows: Receipt[];
  onFlush?: (result: FlushResult) => void;
};

/**
 * Keeps a local copy of the ledger so the receipts list renders offline, and
 * exposes queue helpers so writes survive a dead zone.
 */
export function useOfflineReceipts({ serverRows, onFlush }: Options) {
  const router = useRouter();
  const online = useOnline();
  const [cached, setCached] = React.useState<Receipt[] | null>(null);
  const [outbox, setOutbox] = React.useState<OutboxEntry[]>([]);
  const [syncing, setSyncing] = React.useState(false);

  const refreshOutbox = React.useCallback(async () => {
    setOutbox(await readOutbox());
  }, []);

  // Mirror the server list into IndexedDB whenever we successfully get one.
  React.useEffect(() => {
    void cacheReceipts(serverRows);
  }, [serverRows]);

  // Load the local copy once on mount; it is the fallback when offline.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [rows, queue] = await Promise.all([
        readCachedReceipts(),
        readOutbox(),
      ]);
      if (cancelled) return;
      setCached(rows);
      setOutbox(queue);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = React.useCallback(async () => {
    const queue = await readOutbox();
    if (queue.length === 0) return;

    setSyncing(true);
    const result = await flushOutbox();
    setSyncing(false);
    await refreshOutbox();

    if (result.synced > 0) router.refresh();
    onFlush?.(result);
  }, [refreshOutbox, router, onFlush]);

  // Drain the queue whenever the connection is confirmed back, and once after
  // mount in case the app was opened with writes already waiting. Keyed on
  // `online` rather than on the browser's `online` event: that event is what
  // this hook stopped trusting, and on a device that never fires it the queue
  // used to sit there until the next reload. Deferred rather than called in the
  // effect body so it never triggers a cascading render.
  React.useEffect(() => {
    if (!online) return;
    const timer = setTimeout(() => void flush(), 0);
    return () => clearTimeout(timer);
  }, [flush, online]);

  const receipts: LocalReceipt[] = React.useMemo(() => {
    return mergeOutbox(pickBase(online, serverRows, cached), outbox);
  }, [online, serverRows, cached, outbox]);

  /**
   * Queues a write for later. Throws if local storage is unavailable, so the
   * caller shows an error instead of a false "saved".
   */
  const queue = React.useCallback(
    async (entry: Omit<OutboxEntry, "localId" | "queuedAt" | "attempts">) => {
      const stored = await enqueue({
        ...entry,
        localId: makeLocalId(),
        queuedAt: new Date().toISOString(),
        attempts: 0,
      });

      if (!stored) throw new Error("offline-storage-unavailable");
      await refreshOutbox();
    },
    [refreshOutbox],
  );

  return {
    online,
    syncing,
    receipts,
    pending: outbox.length,
    /** True while the local copy is still being read. */
    hydrating: cached === null,
    queue,
    flush,
  };
}
