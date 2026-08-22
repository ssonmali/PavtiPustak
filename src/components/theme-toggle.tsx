"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

/** Cycles system → light → dark. One tap, no menu — it lives in a tight header. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // The theme is unknown during SSR, so the icon is decided after hydration
  // rather than guessed. useSyncExternalStore gives a stable server snapshot
  // without a setState-in-effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const current = (mounted ? (theme ?? "system") : "system") as keyof typeof ICONS;
  const Icon = ICONS[current] ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${current}`}
      title={`Theme: ${current}`}
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
        setTheme(next);
      }}
    >
      <Icon />
    </Button>
  );
}
