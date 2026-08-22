import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALES,
  dictionaries,
  interpolate,
  type Dictionary,
  type Locale,
  type MessageKey,
} from "./dictionaries";

export const LOCALE_COOKIE = "pp_locale";

function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Reads the chosen language from its cookie; Marathi is the default. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<{
  locale: Locale;
  dict: Dictionary;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}> {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return {
    locale,
    dict,
    t: (key, values) => interpolate(dict[key], values),
  };
}
