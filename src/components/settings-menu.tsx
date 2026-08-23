"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import { NameForm } from "@/components/name-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = ["system", "light", "dark"] as const;

const THEME_ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

/**
 * One gear for everything that isn't the work itself. The header had a theme
 * button, a language button and a logout button competing with the mandal name
 * on a 360px phone; these are all settings, and settings belong behind one.
 */
export function SettingsMenu({
  locale,
  name,
  email,
  derivedName,
}: {
  locale: Locale;
  /** The saved display name, or null when none is set. */
  name: string | null;
  email: string;
  /** The name derived from the email, shown as the placeholder. */
  derivedName: string;
}) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = React.useTransition();
  const [nameOpen, setNameOpen] = React.useState(false);

  // The theme is unknown during SSR, so which item reads as selected is decided
  // after hydration rather than guessed. useSyncExternalStore gives a stable
  // server snapshot without a setState-in-effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const currentTheme = mounted ? (theme ?? "system") : "system";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              disabled={pending}
              aria-label={t("settings.menu")}
              title={t("settings.menu")}
            />
          }
        >
          <Settings />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{t("settings.theme")}</DropdownMenuLabel>
          {/* Left open on choose: the theme applies instantly, so you can see
              the change land without reopening the menu to try the next one. */}
          <DropdownMenuRadioGroup
            value={currentTheme}
            onValueChange={(v) => setTheme(String(v))}
          >
            {THEMES.map((option) => {
              const Icon = THEME_ICONS[option];
              return (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  closeOnClick={false}
                >
                  <Icon />
                  {t(`theme.${option}`)}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(v) => {
              if (v === locale) return;
              startTransition(() => setLocale(String(v)));
            }}
          >
            {LOCALES.map((code) => (
              <DropdownMenuRadioItem key={code} value={code}>
                <Languages />
                {LOCALE_LABELS[code]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setNameOpen(true)}>
            <User /> {t("nav.settings")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => startTransition(() => logout())}
            disabled={pending}
          >
            <LogOut /> {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* A dialog rather than a trip to /dashboard/settings: it is one field,
          and the page is still there for anyone who lands on it directly. */}
      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.title")}</DialogTitle>
            <DialogDescription>{t("settings.subtitle")}</DialogDescription>
          </DialogHeader>
          <NameForm
            name={name}
            email={email}
            derived={derivedName}
            onSaved={() => setNameOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
