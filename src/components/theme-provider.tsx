"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * `class` strategy because globals.css defines dark tokens under `.dark`.
 * Defaults to the device setting: volunteers collecting after dark get the
 * dark UI without being asked.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
