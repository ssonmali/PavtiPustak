"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { shouldAdoptTerm } from "./search-draft";

/**
 * The receipts search box, and the draft term it is typing.
 *
 * Its own component for a performance reason: this state changes per keystroke,
 * and while it lived in ReceiptsTable every character re-rendered the whole
 * ledger — which renders each receipt twice, as a row and as a card, with CSS
 * hiding the half you are not looking at. Fifty receipts meant a hundred row
 * subtrees per letter, unmemoised, on a phone.
 *
 * Here, a keystroke re-renders this input and nothing else.
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

  // What is being typed, deliberately NOT the search term: the term lives in
  // the URL and every change to it is a database query, so the field keeps a
  // draft and pushes it debounced.
  const [draft, setDraft] = React.useState(q);

  /*
   * Re-sync when the term changes elsewhere — the back button, or another
   * control rewriting the query. Adjusted during render rather than in an
   * effect, which would schedule a second render on every URL change.
   *
   * shouldAdoptTerm is what makes it safe: without it this clobbered live
   * typing while a debounced push was in flight. Not a ref, because reading
   * one during render is not allowed and this has to be part of the snapshot.
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
