"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { shouldAdoptTerm } from "./search-draft";

/**
 * The receipts search box, and the draft term it is typing.
 *
 * Its own component for one reason, and it is a performance one: this state
 * changes on every keystroke, and React re-renders the component that owns it.
 * While it lived in ReceiptsTable, every character re-rendered the whole
 * ledger — and that list renders each receipt TWICE, once as a table row and
 * once as a card, with only CSS hiding the half you are not looking at. Fifty
 * receipts meant a hundred row subtrees reconciled per letter, on a phone,
 * with no memoisation anywhere in that file. That is why typing stuttered even
 * on a good handset.
 *
 * Moved down here, a keystroke re-renders this input and nothing else. The
 * ledger re-renders when the term is actually committed — once per pause in
 * typing, not once per letter.
 */
export function ReceiptsSearch({
  q,
  onCommit,
  online,
}: {
  /** The committed term, as parsed from the URL. */
  q: string;
  /** Called with the trimmed term, debounced. */
  onCommit: (q: string) => void;
  /** Searching is a database query, so it needs a connection. */
  online: boolean;
}) {
  const { t } = useI18n();

  /**
   * What is being typed, which is deliberately NOT the search term.
   *
   * The term lives in the URL and every change to it is a database query, so
   * the field keeps its own draft and pushes it debounced. Binding the input
   * straight to the URL would issue a request per keystroke and make typing
   * feel like it is fighting back.
   */
  const [draft, setDraft] = React.useState(q);

  /*
   * Re-sync when the term changes from somewhere else — the back button, or
   * another control rewriting the query.
   *
   * Adjusted during render against the previous value rather than in an
   * effect. Setting state in an effect for this schedules a second render
   * every time the URL changes, and React flags it as cascading; comparing
   * here re-renders once, before anything is painted.
   *
   * shouldAdoptTerm is what makes that safe, and it is not a refinement —
   * without it this clobbered live typing while a debounced push was in
   * flight. See that module for the failure it prevents; it is pure and
   * tested because the naive version reads as obviously correct.
   *
   * Deliberately not a ref holding the last-sent term: reading a ref during
   * render is not allowed, and the lint rule saying so is right — this has to
   * be part of the render snapshot to stay correct if a render is replayed.
   */
  const [syncedQ, setSyncedQ] = React.useState(q);
  if (q !== syncedQ) {
    const adopt = shouldAdoptTerm(q, syncedQ, draft);
    setSyncedQ(q);
    if (adopt) setDraft(q);
  }

  React.useEffect(() => {
    if (draft.trim() === q) return;
    const timer = setTimeout(() => onCommit(draft.trim()), 300);
    return () => clearTimeout(timer);
  }, [draft, q, onCommit]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      {/* z-10 because the input now has a backdrop-filter, which makes it
          a stacking context: a non-positioned element that does so paints
          with the z-index:0 group, in tree order. The icon comes first in
          the DOM, so the field painted over it — and blurred it into its
          own backdrop. Measured, the stroke went from 671 to 261 (sum
          RGB) with this. */}
      <Search className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={online ? t("table.search") : t("table.needsSignal")}
        /* glass-pill: these sit on the mesh, not in a pane — the
           wrapping Card came off when the rows were unnested, and the
           base Input is bg-transparent, so without this the box was just
           a border with text in it. Measured on the pill over the darkest
           blob: placeholder 5.33:1, typed text 12.47:1. No height: the
           44px floor comes from @media (pointer: coarse). */
        className="glass-pill pl-8"
        // Searching and sorting are database queries now, so with no
        // signal they cannot run. Disabled rather than quietly searching
        // the cached copy: a volunteer reading a total has to be able to
        // trust that it is the whole answer.
        disabled={!online}
      />
    </div>
  );
}
