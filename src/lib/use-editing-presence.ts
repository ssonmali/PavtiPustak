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
 * What to push, given the socket state and what this device has open.
 *
 * Pure and exported for the tests. Presence cannot be pushed before the channel
 * has joined — doing so throws — and joining is asynchronous, so every push has
 * to be gated on it rather than on a render.
 */
export function presenceAction(
  joined: boolean,
  editing: string | null,
  tracked: boolean,
): "track" | "untrack" | "none" {
  // Nothing can be pushed yet. Whatever is open will be tracked by the rejoin.
  if (!joined) return "none";
  if (editing) return "track";
  // Only worth a push if this device actually has presence to withdraw; on
  // mount, and after a close that already untracked, there is nothing to clear.
  return tracked ? "untrack" : "none";
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
  /** True only between a SUBSCRIBED ack and the socket dropping. */
  const [joined, setJoined] = React.useState(false);
  /** Whether this device currently has presence on the channel. */
  const trackedRef = React.useRef(false);

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
      // Presence can only be pushed once the server has acked the join, so the
      // publish effect below waits on this rather than on the first render.
      channel.subscribe((status) => {
        if (disposed) return;
        setJoined(status === "SUBSCRIBED");
      });
    })();

    return () => {
      disposed = true;
      channelRef.current = null;
      trackedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  // Publish what this device has open. Untracking on close is what lets the
  // other volunteer's warning disappear again.
  React.useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // A dropped socket takes this device's presence with it, so a reconnect has
    // to re-announce: `joined` going false then true re-runs this effect.
    if (!joined) {
      trackedRef.current = false;
      return;
    }

    const action = presenceAction(joined, editing, trackedRef.current);
    if (action === "none") return;

    void (async () => {
      if (action === "track") {
        await channel.track({ receipt_id: editing, who: myName });
        trackedRef.current = true;
      } else {
        await channel.untrack();
        trackedRef.current = false;
      }
    })();
  }, [joined, editing, myName]);

  return {
    /** Receipt id → names of other volunteers with it open. */
    editors,
    /** Call with a receipt id while its dialog is open, null when it closes. */
    setEditing,
  };
}
