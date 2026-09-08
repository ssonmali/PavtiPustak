"use client";

import * as React from "react";

import { getWallpaper } from "@/lib/offline/db";

export const WALLPAPER_SIZES = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
} as const;

export const WALLPAPER_CHANGED = "pp:wallpaper-changed";

export function CustomBackground() {
  React.useEffect(() => {
    let urls: string[] = [];
    let cancelled = false;

    async function apply() {
      const root = document.documentElement;
      const next: string[] = [];

      for (const key of ["portrait", "landscape"] as const) {
        const blob = await getWallpaper(key);
        if (cancelled) return;
        const property = `--mandap-photo-${key}`;
        if (!blob) {
          root.style.removeProperty(property);
          continue;
        }
        const url = URL.createObjectURL(blob);
        next.push(url);
        root.style.setProperty(property, `url("${url}")`);
      }

      for (const url of urls) URL.revokeObjectURL(url);
      urls = next;
    }

    void apply();
    const onChange = () => void apply();
    window.addEventListener(WALLPAPER_CHANGED, onChange);

    return () => {
      cancelled = true;
      window.removeEventListener(WALLPAPER_CHANGED, onChange);
      for (const url of urls) URL.revokeObjectURL(url);
      const root = document.documentElement;
      root.style.removeProperty("--mandap-photo-portrait");
      root.style.removeProperty("--mandap-photo-landscape");
    };
  }, []);

  return null;
}
