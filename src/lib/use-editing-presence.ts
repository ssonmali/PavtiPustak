"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/** Who is editing which receipt, keyed by receipt id. */
export type Editors = Record<string, string[]>;

type Payload = { receipt_id: string; who: string };

/**
 * Folds a presence state into "who else has this receipt open".
 *
 * Pure, and exported for the tests: the filtering is the part worth getting
 * right — your own entries must not appear, or your own dialog would warn you
 * about yourself.
 */
export function editorsFromPresence(
  state: Record<string, Payload[]>,
  myName: string,
): Editors {
  const next: Editors = {};

  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry?.receipt_id || !entry.who) continue;
      if (entry.who === myName) continue;
      const already = next[entry.receipt_id] ?? [];
      // Two tabs from the same person read as one editor.
      if (already.includes(entry.who)) continue;
      next[entry.receipt_id] = [...already, entry.who];
    }
  }
  return next;
}

/**
 * Announces which receipt this volunteer has open, and reports who else has one
 * open right now.
 *
 * Built on Realtime Presence rather than a lock column: an edit lock has to
 * disappear when a phone goes into a tunnel or a tab is closed, and presence
 * does that for free when the socket drops. Nothing is written to the database,
 * so a stale lock cannot outlive the session that took it.
 *
 * This is advisory. Saving is still guarded by the `updated_at` check, which is
 * what actually prevents one volunteer overwriting another.
 */
export function useEditingPresence(myName: string) {
  const [editors, setEditors] = React.useState<Editors>({});
  /** The receipt this device is editing, mirrored so the effect can re-track. */
  const [editing, setEditing] = React.useState<string | null>(null);

  // Read inside the presence handler without re-subscribing on every change.
  const myNameRef = React.useRef(myName);
  React.useEffect(() => {
    myNameRef.current = myName;
  }, [myName]);

  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let disposed = false;

    const channel = supabase.channel("receipt-editors", {
      config: { presence: { key: "" } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      if (disposed) return;
      setEditors(
        editorsFromPresence(channel.presenceState<Payload>(), myNameRef.current),
      );
    });

    void (async () => {
      // Presence is subject to RLS on the socket, same as postgres_changes.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      channel.subscribe();
    })();

    return () => {
      disposed = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  // Publish what this device has open. Untracking on close is what lets the
  // other volunteer's warning disappear again.
  React.useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    void (async () => {
      if (editing) {
        await channel.track({ receipt_id: editing, who: myName });
      } else {
        await channel.untrack();
      }
    })();
  }, [editing, myName]);

  return {
    /** Receipt id → names of other volunteers with it open. */
    editors,
    /** Call with a receipt id while its dialog is open, null when it closes. */
    setEditing,
  };
}
