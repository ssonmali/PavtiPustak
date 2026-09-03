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
 * Defaults to the device setting: volunteers collecting after dark get the
 * dark UI without being asked.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
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
