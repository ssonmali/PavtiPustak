"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The filter controls for one tab, collapsed behind a single button on phones.
 *
 * Phones only — `sm:hidden` on the trigger, and the tabs keep rendering their
 * chip rows inline from `sm` up. That is not laziness about one shared
 * component: a chip row is strictly better than a sheet when there is room for
 * it, because it shows the whole filter state and takes one tap to change.
 * The sheet exists because on a 360px screen that same row wraps to three
 * lines and pushes the ledger below the fold.
 *
 * TWO CONTRACTS, both of which exist because a sheet hides what it holds:
 *
 *  1. The trigger carries the APPLIED state — the count and the names. Hiding
 *     filters hides the fact that a filter is on, and this is a ledger: a
 *     volunteer reading a total under "Today + Unpaid" as the all-time figure
 *     has been misled by the UI, not by their own carelessness.
 *  2. Changes are STAGED and committed on Done, not applied per tap. On the
 *     receipts and report tabs every control writes the URL, so applying
 *     immediately meant a navigation and a database query per tap — picking a
 *     period, a status and a sort was three round trips on a phone connection
 *     to reach one list. Now it is one. Dismissing without Done discards,
 *     which is the standard bargain for a sheet with an explicit commit.
 *
 *     "Clear all" is the deliberate exception and applies on the tap; see the
 *     note on it below.
 *
 * Generic over the tab's filter shape: `value` is what is applied, the render
 * prop gets the draft and a patcher, and `summarise` turns either into names.
 * One summariser rather than two keeps the trigger and the sheet from ever
 * describing the same state differently.
 *
 * Built on base-ui's dialog directly rather than on ui/dialog.tsx, which is a
 * vendored shadcn file whose DialogContent is centred on the visual viewport —
 * the wrong geometry for a sheet, and not worth forking a file that
 * `shadcn add` would overwrite. It still carries data-slot="dialog-content" so
 * every rule already written for overlays finds it: the Devasthan glass and
 * gold rim, the text halo, and `display: none` under @media print.
 */
export function FilterSheet<T>({
  value,
  defaults,
  onApply,
  summarise,
  children,
  className,
}: {
  /** The filters as currently applied to the list. */
  value: T;
  /** The unfiltered selection. "Clear all" applies this straight away. */
  defaults: T;
  /** Called once with the whole draft — on Done, or on "Clear all". */
  onApply: (next: T) => void;
  /** The active filters in `v`, already localised — e.g. ["Today", "Unpaid"]. */
  summarise: (v: T) => string[];
  children: (draft: T, patch: (part: Partial<T>) => void) => React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<T>(value);
  /**
   * What the commit button said at the moment the sheet started closing.
   *
   * On the tabs that hold their filters in local state, onApply lands before
   * the exit animation has played, so `dirty` flips false and the button
   * relabelled itself from Apply to Done mid-fade — a small but real flicker,
   * and one of two causes of it. Latched here so nothing inside the sheet
   * changes after the volunteer has dismissed it.
   */
  const [closingDirty, setClosingDirty] = React.useState(false);

  const patch = React.useCallback(
    (part: Partial<T>) => setDraft((d) => ({ ...d, ...part })),
    [],
  );

  /**
   * The draft is seeded on every open rather than kept in step with `value`.
   *
   * It has to be re-seeded and not merely initialised: `value` can move while
   * the sheet is shut — the desktop chip rows are live at the same width the
   * sheet exists at during a rotate, and the receipts tab reads its filters
   * from the URL, so a back button changes them. Without this, reopening
   * would show, and Done would re-apply, a stale selection.
   */
  function onOpenChange(next: boolean) {
    if (next) setDraft(value);
    else setClosingDirty(dirty);
    setOpen(next);
  }

  const applied = summarise(value);
  const staged = summarise(draft);
  const active = applied.length > 0;

  /*
   * Whether Done has anything to commit.
   *
   * Compared as JSON, which is sound only because every draft is built by
   * patching one object of a fixed shape — so the keys keep their order and
   * the values are the plain data the URL round-trips anyway. It would not
   * survive a Date, a Set, or an undefined-vs-absent distinction being added
   * to a tab's filter type.
   */
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  // The names when they fit, the count when they do not. Three filters spelled
  // out overflow a 360px button and truncate to "Today · Unpa…", which reads
  // as broken rather than as brief.
  const label =
    active && applied.length <= 2
      ? applied.join(" · ")
      : active
        ? t("filters.activeCount", { count: applied.length })
        : t("filters.title");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        render={
          <Button
            size="sm"
            /* `secondary` while filtered, matching the chips: a control that
               is doing something wears the solid fill, and the glass pill is
               for the resting state. The same rule the chip rows follow. */
            variant={active ? "secondary" : "outline"}
            className={cn(
              "shrink-0 rounded-full sm:hidden",
              !active && "glass-pill",
              className,
            )}
          />
        }
      >
        <SlidersHorizontal />
        <span className="max-w-40 truncate">{label}</span>
        {active ? (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
            {applied.length}
          </span>
        ) : null}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="dialog-overlay"
          /* sheet-scrim, not fade-in-0/fade-out-0: those carry a filter in
             their keyframes, which fights the backdrop-blur here — see the
             note on @keyframes sheet-rise in globals.css. */
          className="sheet-scrim fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
        />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed z-50 flex flex-col gap-4 rounded-t-2xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
            /*
             * Positioned with insets and NOT with a transform, which is the
             * whole reason this reads differently from ui/dialog.tsx.
             *
             * The slide keyframes animate `transform`, and they set the whole
             * property — translate3d(...) scale3d(...) — rather than adding to
             * it. So a layout transform here does not compose with the
             * animation, it gets clobbered by it: the first and last frame of
             * every close put the sheet 100% lower and un-centred for one
             * frame, which is exactly the flicker on dismiss. Insets leave the
             * transform channel free for the animation to own.
             *
             * inset-x-0 also drops the horizontal centring: the sheet is full
             * width, so there was nothing to centre.
             *
             * The bottom edge tracks the VISUAL viewport, not the layout one —
             * MobileKeyboard publishes --visual-top/--visual-height, and
             * without them a focused date field would leave the on-screen
             * keyboard covering the sheet, the one thing a bottom sheet must
             * never do. Measured from the layout viewport's bottom, that gap
             * is 100dvh minus the visual viewport's own bottom edge; with the
             * fallbacks it collapses to 0, which is what desktop gets.
             */
            "inset-x-0 bottom-[calc(100dvh-var(--visual-top,0px)-var(--visual-height,100dvh))]",
            // Capped so a long filter set scrolls rather than covering the
            // page it is filtering — you have to be able to see what changed.
            "max-h-[80svh] overflow-y-auto",
            /* See @keyframes sheet-rise in globals.css: transform and opacity
               only, because this element carries a backdrop-filter and the
               stock animate-in/out keyframes add a filter on top of it. */
            "sheet-anim",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <DialogPrimitive.Title className="font-heading text-base leading-none font-medium">
              {t("filters.title")}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              {/* The one control that does NOT stage: clearing applies on the
                  tap. It is the only unambiguous intent in the sheet — there
                  is nothing to review about "no filters", so making it wait
                  for Done just added a step to the fastest way back to the
                  whole ledger. The draft is reset alongside so the sections
                  below agree with what was just applied. */}
              {staged.length > 0 ? (
                <Button
                  size="sm"
                  /* outline + glass-pill rather than ghost, which has no
                     background of its own and so read as a line of text
                     rather than as the action it is. The pill is not
                     decoration either: the outline variant carries
                     dark:bg-input/30, which fires in the Devasthan themes and
                     would wash this gold — .glass-pill is the theme-scoped
                     override that keeps it the same neutral glass as the
                     chips. */
                  variant="outline"
                  className="glass-pill rounded-full"
                  onClick={() => {
                    setDraft(defaults);
                    onApply(defaults);
                  }}
                >
                  {t("filters.clear")}
                </Button>
              ) : null}
              {/* Dismiss discards, so this is a cancel in everything but
                  name — the staged bargain above. */}
              <DialogPrimitive.Close
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <X />
                <span className="sr-only">{t("filters.close")}</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* What is selected, spelled out. The chips below already carry it in
              their fills, but only one section at a time is on screen once the
              sheet scrolls, and nothing else names the whole selection in one
              place — which is the thing a collapsed filter most needs to say.
              This is the DRAFT, i.e. what Done is about to apply. */}
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{t("filters.selected")}:</span>{" "}
            {staged.length > 0 ? staged.join(" · ") : t("filters.none")}
          </p>

          {children(draft, patch)}

          {/* The commit. Named for what it does when there is something to do:
              a volunteer who has changed nothing is dismissing the sheet, and
              a volunteer who has should see that a tap is what applies it. */}
          <Button
            className="w-full"
            onClick={() => {
              // Latched before onApply, which on some tabs updates `value`
              // synchronously and would otherwise relabel this button while
              // it is still on screen fading out.
              setClosingDirty(dirty);
              if (dirty) onApply(draft);
              setOpen(false);
            }}
          >
            {(open ? dirty : closingDirty)
              ? t("filters.apply")
              : t("filters.done")}
          </Button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** One labelled group inside the sheet. */
export function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}
