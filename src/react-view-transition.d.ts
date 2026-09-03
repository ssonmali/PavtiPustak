/**
 * A type for React's <ViewTransition>, which exists at runtime but not in
 * @types/react.
 *
 * This is not a guess. The App Router runs on React's canary channel, which
 * Next ships vendored — `require("next/dist/compiled/react/...").ViewTransition`
 * is a symbol, while the `react` package installed here (19.2.8) has no such
 * export, and its @types are written against that package. So the component
 * works, and only the compiler disagrees.
 *
 * Declared as a module augmentation rather than with `any` at the call sites,
 * so the props are still checked: a typo in `share` or a missing `name` is
 * caught here exactly as it would be if React shipped these types itself.
 *
 * Delete this file when @types/react gains ViewTransition. The build will say
 * so — a duplicate declaration is an error, not a silent shadow.
 */
import "react";

declare module "react" {
  interface ViewTransitionProps {
    children?: import("react").ReactNode;
    /**
     * Pairs an element on the old page with one on the new page. Same name on
     * both sides is what makes React morph rather than crossfade, and a name
     * must be unique among the elements actually being rendered.
     */
    name?: string;
    /** Class applied when a named pair morphs, for ::view-transition-group. */
    share?: string | null;
    /** Class applied when the element is entering. */
    enter?: string | null;
    /** Class applied when the element is leaving. */
    exit?: string | null;
    /**
     * What happens during transitions this element is not the subject of.
     * "none" keeps it still, which is almost always what is wanted: without
     * it every named element animates on every unrelated transition.
     */
    default?: string | null;
    update?: string | null;
  }

  const ViewTransition: import("react").ExoticComponent<ViewTransitionProps>;
}
