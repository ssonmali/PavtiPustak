import { describe, expect, it, vi } from "vitest";
import { localId, mergeOutbox } from "@/lib/offline/merge";
import type { OutboxEntry } from "@/lib/offline/db";
import type { Receipt } from "@/lib/types";

const row = (over: Partial<Receipt> = {}): Receipt => ({
  id: "server-1",
  receipt_number: 10,
  donor_name: "Sunil",
  amount: 501,
  phone_number: "9876543210",
  payment_method: "Cash",
  collection_date: "2026-08-20",
  created_at: "2026-08-20T10:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
  user_id: "u1",
  created_by_email: "a@b.c",
  payment_status: "Paid",
  due_on: null,
  ...over,
});

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  localId: "local-1",
  kind: "create",
  queuedAt: "2026-08-22T10:00:00Z",
  attempts: 0,
  ...over,
});

const fields = {
  donor_name: "Nita",
  amount: 1001,
  phone_number: "9000000000",
  payment_method: "UPI" as const,
  collection_date: "2026-08-22",
};

describe("mergeOutbox", () => {
  it("returns the server rows untouched when nothing is queued", () => {
    expect(mergeOutbox([row()], [])).toEqual([{ ...row() }]);
  });

  it("shows a queued create with a pending marker and no receipt number", () => {
    const merged = mergeOutbox([], [entry({ kind: "create", fields })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].pending).toBe("create");
    expect(merged[0].receipt_number).toBe(0);
    expect(merged[0].donor_name).toBe("Nita");
  });

  it("floats pending creates above synced rows", () => {
    const merged = mergeOutbox(
      [row({ collection_date: "2026-08-30" })],
      [entry({ kind: "create", fields })],
    );
    // Even though the server row has a later date, unsynced work comes first.
    expect(merged[0].pending).toBe("create");
  });

  it("applies a queued edit over the server row", () => {
    const merged = mergeOutbox(
      [row()],
      [entry({ kind: "update", receiptId: "server-1", fields })],
    );
    expect(merged[0].amount).toBe(1001);
    expect(merged[0].pending).toBe("update");
    // The identity of the row is preserved, not replaced by a local one.
    expect(merged[0].id).toBe("server-1");
  });

  it("marks a queued delete rather than dropping the row", () => {
    // Keeping it visible-but-marked means the volunteer can see what will go.
    const merged = mergeOutbox(
      [row()],
      [entry({ kind: "delete", receiptId: "server-1" })],
    );
    expect(merged[0].pending).toBe("delete");
  });

  it("ignores an edit for a row it does not have", () => {
    const merged = mergeOutbox(
      [row()],
      [entry({ kind: "update", receiptId: "missing", fields })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(501);
  });

  it("applies queued entries in order", () => {
    const merged = mergeOutbox(
      [row()],
      [
        entry({
          localId: "l1",
          kind: "update",
          receiptId: "server-1",
          fields: { ...fields, amount: 700 },
          queuedAt: "2026-08-22T09:00:00Z",
        }),
        entry({
          localId: "l2",
          kind: "update",
          receiptId: "server-1",
          fields: { ...fields, amount: 900 },
          queuedAt: "2026-08-22T10:00:00Z",
        }),
      ],
    );
    // Last write wins, matching what the server will end up with.
    expect(merged[0].amount).toBe(900);
  });

  it("sorts synced rows newest-date-first", () => {
    const merged = mergeOutbox(
      [
        row({ id: "a", collection_date: "2026-08-01", receipt_number: 1 }),
        row({ id: "b", collection_date: "2026-08-15", receipt_number: 2 }),
      ],
      [],
    );
    expect(merged.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("localId", () => {
  it("is prefixed so a local row is distinguishable from a server uuid", () => {
    expect(localId().startsWith("local-")).toBe(true);
  });

  it("works without crypto.randomUUID (plain http has no secure context)", () => {
    // How the app is actually tested from a phone: http://192.168.x.x, where
    // randomUUID is undefined and the old code threw.
    vi.stubGlobal("crypto", {});
    try {
      const first = localId();
      expect(first.startsWith("local-")).toBe(true);
      expect(first.length).toBeGreaterThan(10);
      expect(localId()).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
