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

/** True when the browser reports no connectivity. */
export function useOnline() {
  // Assume online during SSR and the first paint, so the markup matches.
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
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

  // Drain the queue when the network returns, and once after mount in case the
  // app was opened with writes already waiting. Deferred rather than called in
  // the effect body so it never triggers a cascading render.
  React.useEffect(() => {
    const onReconnect = () => void flush();
    window.addEventListener("online", onReconnect);
    const timer = setTimeout(onReconnect, 0);

    return () => {
      window.removeEventListener("online", onReconnect);
      clearTimeout(timer);
    };
  }, [flush]);

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
