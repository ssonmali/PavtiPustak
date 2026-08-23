"use client";

import type { Receipt } from "@/lib/types";

/**
 * A tiny promisified IndexedDB layer. No dependency: the app needs three
 * object stores and nothing an ORM would help with.
 */
const DB_NAME = "pavti-pustak";
const DB_VERSION = 1;

export const STORE_RECEIPTS = "receipts";
export const STORE_OUTBOX = "outbox";
export const STORE_META = "meta";

export type OutboxKind = "create" | "update" | "delete";

export type OutboxEntry = {
  /** Client-generated id; also the optimistic row's id until it syncs. */
  localId: string;
  kind: OutboxKind;
  /** Server id for update/delete. */
  receiptId?: string;
  /**
   * The receipt fields, for create/update. Spelled out rather than reusing
   * ReceiptInput: these rows are persisted on the device, so widening the type
   * has to be a deliberate edit that considers entries queued by an older
   * build — hence the optional status fields, which such entries will lack.
   */
  fields?: {
    donor_name: string;
    amount: number;
    phone_number: string;
    payment_method: "Cash" | "UPI";
    collection_date: string;
    payment_status?: "Paid" | "Unpaid";
    due_on?: string | null;
  };
  /** The updated_at the edit was based on, for optimistic locking. */
  expectedUpdatedAt?: string;
  queuedAt: string;
  /** Incremented on a failed flush so a poison entry cannot loop forever. */
  attempts: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECEIPTS)) {
        db.createObjectStore(STORE_RECEIPTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Private browsing and some embedded webviews reject IndexedDB entirely. */
export function isAvailable() {
  return typeof indexedDB !== "undefined";
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  if (!isAvailable()) return undefined;
  try {
    const db = await openDb();
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = run(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  } catch {
    // Never let a storage failure break the page.
    return undefined;
  }
}

// --- Cached receipts -------------------------------------------------

export async function cacheReceipts(receipts: Receipt[]) {
  if (!isAvailable() || receipts.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_RECEIPTS, "readwrite");
      const store = transaction.objectStore(STORE_RECEIPTS);
      // Replace wholesale: the server list is the truth when we can reach it.
      store.clear();
      for (const receipt of receipts) store.put(receipt);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    /* storage full or blocked — the app still works online */
  }
}

export async function readCachedReceipts(): Promise<Receipt[]> {
  const rows = await tx<Receipt[]>(STORE_RECEIPTS, "readonly", (s) =>
    s.getAll() as IDBRequest<Receipt[]>,
  );
  return rows ?? [];
}

// --- Outbox ----------------------------------------------------------

/**
 * Returns false when the write did not land — private browsing and some
 * embedded webviews block IndexedDB outright. The caller must surface that
 * rather than telling the volunteer their receipt is safe.
 */
export async function enqueue(entry: OutboxEntry): Promise<boolean> {
  if (!isAvailable()) return false;
  const result = await tx(STORE_OUTBOX, "readwrite", (s) => s.put(entry));
  return result !== undefined;
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const rows =
    (await tx<OutboxEntry[]>(STORE_OUTBOX, "readonly", (s) =>
      s.getAll() as IDBRequest<OutboxEntry[]>,
    )) ?? [];
  // Oldest first: replaying out of order could delete before it creates.
  return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function dequeue(localId: string) {
  await tx(STORE_OUTBOX, "readwrite", (s) => s.delete(localId));
}

export async function setMeta(key: string, value: unknown) {
  await tx(STORE_META, "readwrite", (s) => s.put({ key, value }));
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await tx<{ key: string; value: T }>(STORE_META, "readonly", (s) =>
    s.get(key) as IDBRequest<{ key: string; value: T }>,
  );
  return row?.value;
}
