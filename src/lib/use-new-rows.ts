"use client";

import * as React from "react";

/**
 * How long a row stays marked as new. Long enough to find after looking away
 * to put the phone down, short enough that it is gone before it becomes part
 * of how the list looks.
 */
const FLASH_MS = 1400;

/**
 * The rows that have just appeared in a list.
 *
 * A receipt saved on this device and one another volunteer just wrote arrive
 * the same way — the server data is replaced and a row the list did not have
 * before is in it. Marking them is what turns "the list is different now" into
 * "that one is yours", which matters most on a phone, where the new row can
 * land off the top of the fold.
 *
 * Nothing is marked on the first render: on arriving at the page every row is
 * new, and flashing the whole ledger says nothing at all.
 */
export function useNewRows(ids: string[]): ReadonlySet<string> {
  const seen = React.useRef<Set<string> | null>(null);
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // The effect depends on the ids themselves, not on the identity of the array
  // holding them — that is new on every render. Ids are uuids, so joining and
  // splitting them round-trips exactly, and the key doubles as the payload.
  const key = ids.join(",");

  React.useEffect(() => {
    const current = key ? key.split(",") : [];
    if (seen.current === null) {
      seen.current = new Set(current);
      return;
    }

    const added = current.filter((id) => !seen.current!.has(id));
    for (const id of current) seen.current.add(id);
    if (added.length === 0) return;

    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), FLASH_MS);
    return () => clearTimeout(timer);
  }, [key]);

  return fresh;
}
