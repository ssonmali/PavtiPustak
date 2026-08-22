"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/dictionaries";

/** Persists the language choice for a year; setting a cookie re-renders the tree. */
export async function setLocale(locale: string) {
  const next: Locale = LOCALES.includes(locale as Locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;

  (await cookies()).set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
