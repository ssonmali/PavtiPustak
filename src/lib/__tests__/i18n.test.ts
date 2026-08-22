import { describe, expect, it } from "vitest";
import { dictionaries, interpolate, LOCALES } from "@/lib/i18n/dictionaries";

describe("dictionaries", () => {
  it("defines every key in every locale", () => {
    const keys = Object.keys(dictionaries.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(keys);
    }
  });

  it("has no empty translations", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps the same placeholders across locales", () => {
    const placeholders = (s: string) =>
      (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");

    for (const [key, en] of Object.entries(dictionaries.en)) {
      expect(
        placeholders(dictionaries.mr[key as keyof typeof dictionaries.en]),
        `mismatched placeholders in ${key}`,
      ).toBe(placeholders(en));
    }
  });
});

describe("interpolate", () => {
  it("substitutes named values", () => {
    expect(interpolate("{a} of {b}", { a: 1, b: 2 })).toBe("1 of 2");
  });

  it("leaves unknown placeholders intact rather than printing undefined", () => {
    expect(interpolate("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});
