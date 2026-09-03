"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * The four themes, and the one list they are declared in.
 *
 * `system` is not here: next-themes owns that name and resolves it to one of
 * these. Which is also why the two Devasthan themes cannot participate in
 * `system` — the device tells us light or dark, and nothing more.
 */
export const THEMES = [
  "light",
  "dark",
  "devasthan-day",
  "devasthan-night",
] as const;

export type Theme = "system" | (typeof THEMES)[number];

/**
 * `class` strategy because globals.css defines dark tokens under `.dark`, and
 * the two Devasthan themes under classes of their own — see the `dark` custom
 * variant at the top of that file, which lists all three so the app's `dark:`
 * utilities fire under any of them.
 *
 * Defaults to devasthan-day rather than the device setting: this is the
 * mandal's theme, and a volunteer's first open should show it without asking.
 * `enableSystem` stays on so "System" remains a choice in the menu — it just
 * is not the initial one — and it still governs what `system` resolves to
 * for anyone who picks it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="devasthan-day"
      // Without this next-themes only recognises light and dark, and picking
      // either Devasthan theme would be written to storage and then dropped
      // on the next load.
      themes={[...THEMES]}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
