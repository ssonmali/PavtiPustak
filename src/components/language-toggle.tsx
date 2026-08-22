"use client";

import * as React from "react";
import { Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const [pending, startTransition] = React.useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(() => setLocale(next));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={pending} title="Language">
            <Languages /> {LOCALE_LABELS[locale]}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onClick={() => choose(code)}>
            {LOCALE_LABELS[code]}
            {code === locale ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
