"use client";

import * as React from "react";
import {
  DEFAULT_LOCALE,
  dictionaries,
  interpolate,
  type Locale,
  type MessageKey,
} from "./dictionaries";

type Ctx = {
  locale: Locale;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  t: (key) => dictionaries[DEFAULT_LOCALE][key],
});

/**
 * The server passes only the locale; both dictionaries are small enough that
 * shipping them beats a round-trip, and it keeps the toggle instant.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = React.useMemo<Ctx>(
    () => ({
      locale,
      t: (key, values) => interpolate(dictionaries[locale][key], values),
    }),
    [locale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}
