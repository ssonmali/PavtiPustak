"use client";

import * as React from "react";

/**
 * Two things the on-screen keyboard breaks, fixed in one place.
 *
 * 1. It covers what is being typed. `dvh` does not shrink when the keyboard
 *    comes up — the layout viewport is unchanged, only the *visual* one gets
 *    smaller — so a dialog centred on 90dvh keeps sitting behind the keys.
 *    The visual viewport is published as CSS variables instead, and anything
 *    that must stay in sight sizes to those rather than to the screen.
 *
 * 2. Tapping away from a field does not dismiss it. On a phone the keyboard
 *    only closes on Done or a back gesture, so a tap on the dialog's own
 *    padding leaves it up, hiding the very fields the tap was meant to reach.
 *
 * Both are no-ops on a desktop browser: `visualViewport` matches the layout
 * viewport there, and a mouse click on empty space already blurs.
 */
export function MobileKeyboard() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let previous = vv.height;
    const sync = () => {
      root.style.setProperty("--visual-height", `${vv.height}px`);
      // How far the visual viewport has been pushed down the page. Without it
      // a centred dialog would be centred on the right *height* in the wrong
      // *place* once the page itself has been scrolled by the focus.
      root.style.setProperty("--visual-top", `${vv.offsetTop}px`);

      // The keyboard coming up is the moment to put the field back in sight:
      // it is focused before the viewport shrinks, so the browser's own
      // scroll-into-view ran against the taller box and left it out of view.
      // 80px, because the address bar collapsing is also a resize and must not
      // be mistaken for a keyboard.
      const opened = vv.height < previous - 80;
      previous = vv.height;
      if (!opened) return;

      const active = document.activeElement;
      if (
        !(active instanceof HTMLInputElement) &&
        !(active instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      // After the frame that applies the shrink, so the field is centred in
      // the box it will actually end up in.
      requestAnimationFrame(() =>
        active.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      root.style.removeProperty("--visual-height");
      root.style.removeProperty("--visual-top");
    };
  }, []);

  React.useEffect(() => {
    /**
     * Anything that owns the keyboard, or that a tap is already meant for.
     * Blurring on the way into a button would be harmless, but blurring on the
     * way into a *label* would steal the focus it is about to hand over.
     */
    const KEEPS_FOCUS =
      "input, textarea, select, button, a, label, [contenteditable=''], [contenteditable='true'], [role='combobox'], [role='option'], [role='menuitem']";

    const onPointerDown = (event: PointerEvent) => {
      const active = document.activeElement;
      if (
        !(active instanceof HTMLInputElement) &&
        !(active instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest(KEEPS_FOCUS)) return;
      active.blur();
    };

    // Capture, so a stopPropagation() somewhere in a dialog cannot swallow it.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
