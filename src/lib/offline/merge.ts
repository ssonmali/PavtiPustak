import type { Receipt } from "@/lib/types";
import type { OutboxEntry } from "./db";

/** A receipt not yet accepted by the server, or awaiting an edit/delete. */
export type PendingState = "create" | "update" | "delete";
export type LocalReceipt = Receipt & { pending?: PendingState };

/**
 * Stable placeholder id for a receipt that has never reached the server.
 *
 * `crypto.randomUUID` is secure-context only, so it is missing over plain http
 * — which is exactly how the app gets tested from a phone on the LAN. Uniqueness
 * here only has to hold within one device's queue.
 */
export function localId() {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `local-${uuid}`;
}

/**
 * Overlays queued offline changes onto the last known server list, so the UI
 * shows what the volunteer believes is true rather than what synced.
 *
 * Pure and dependency-free so it can be unit tested.
 */
export function mergeOutbox(
  rows: Receipt[],
  outbox: OutboxEntry[],
): LocalReceipt[] {
  const byId = new Map<string, LocalReceipt>(rows.map((r) => [r.id, { ...r }]));

  for (const entry of outbox) {
    if (entry.kind === "delete" && entry.receiptId) {
      const existing = byId.get(entry.receiptId);
      if (existing) byId.set(entry.receiptId, { ...existing, pending: "delete" });
      continue;
    }

    if (entry.kind === "update" && entry.receiptId && entry.fields) {
      const existing = byId.get(entry.receiptId);
      if (existing) {
        byId.set(entry.receiptId, {
          ...existing,
          ...entry.fields,
          pending: "update",
        });
      }
      continue;
    }

    if (entry.kind === "create" && entry.fields) {
      byId.set(entry.localId, {
        id: entry.localId,
        // The server assigns the real number from a sequence on sync.
        receipt_number: 0,
        ...entry.fields,
        created_at: entry.queuedAt,
        updated_at: entry.queuedAt,
        user_id: "",
        created_by_email: null,
        // Defaults for anything the queued fields did not carry, so a pending
        // row is a complete Receipt for rendering purposes.
        payment_status: entry.fields.payment_status ?? "Paid",
        due_on: entry.fields.due_on ?? null,
        pending: "create",
      });
    }
  }

  return [...byId.values()].sort((a, b) => {
    // Pending creates float to the top; otherwise newest date, then number.
    if (a.pending === "create" && b.pending !== "create") return -1;
    if (b.pending === "create" && a.pending !== "create") return 1;
    const byDate = b.collection_date.localeCompare(a.collection_date);
    return byDate !== 0 ? byDate : b.receipt_number - a.receipt_number;
  });
}

/** Counts entries still waiting, for the header indicator. */
export function pendingCount(outbox: OutboxEntry[]) {
  return outbox.length;
}

/**
 * Which list the UI should show: the server's, or this device's copy.
 *
 * Online, the server is the truth even when it returns nothing — an empty
 * ledger is a fact, and treating "empty" as "not loaded" left deleted receipts
 * on screen with no way to clear them. Offline, prefer the device copy: the
 * HTML may have come from the service worker cache and be older than IndexedDB.
 */
export function pickBase(
  online: boolean,
  serverRows: Receipt[],
  cached: Receipt[] | null,
): Receipt[] {
  if (online) return serverRows;
  return cached?.length ? cached : serverRows;
}
