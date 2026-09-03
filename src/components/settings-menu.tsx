"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Flame,
  Lamp,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { THEMES as THEME_NAMES } from "@/components/theme-provider";
import { logout } from "@/app/actions/auth";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import { NameForm } from "@/components/name-form";
import { clearOfflineData } from "@/lib/offline";
import { clearPrivateCache } from "@/components/service-worker";
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

/* "system" first because it is the default, then the two plain themes, then
   the festival pair. The names come from theme-provider so the menu cannot
   offer a theme next-themes has not been told about. */
const THEMES = ["system", ...THEME_NAMES] as const;

const THEME_ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  /* A lamp and a flame: both Devasthan variants are the same photo, so the
     icons have to distinguish the light rather than the subject. */
  "devasthan-day": Lamp,
  "devasthan-night": Flame,
} as const;

/* The dictionary keys are camelCase; the theme names are the CSS class names,
   which are not. */
const THEME_LABEL_KEYS = {
  system: "theme.system",
  light: "theme.light",
  dark: "theme.dark",
  "devasthan-day": "theme.devasthanDay",
  "devasthan-night": "theme.devasthanNight",
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
          {/* Each heading sits inside its group: Base UI's group label reads a
              context the group provides and throws outright without one, and
              nesting is what associates the heading with the group for a
              screen reader. */}
          {/* Left open on choose: the theme applies instantly, so you can see
              the change land without reopening the menu to try the next one. */}
          <DropdownMenuRadioGroup
            value={currentTheme}
            onValueChange={(v) => setTheme(String(v))}
          >
            <DropdownMenuLabel>{t("settings.theme")}</DropdownMenuLabel>
            {THEMES.map((option) => {
              const Icon = THEME_ICONS[option];
              return (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  closeOnClick={false}
                >
                  <Icon />
                  {t(THEME_LABEL_KEYS[option])}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(v) => {
              if (v === locale) return;
              startTransition(() => setLocale(String(v)));
            }}
          >
            <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
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
            onClick={() =>
              startTransition(() => {
                // Before the redirect. Two separate stores hold this
                // volunteer's ledger on a phone they may well share: the
                // service worker's rendered dashboard pages, and the receipt
                // rows cached in IndexedDB. Leaving either behind shows the
                // next volunteer the previous one's donors.
                clearPrivateCache();
                // Chained, not fire-and-forget: the clear has to land before
                // the redirect, or a slow phone signs out with the rows still
                // on disk.
                return clearOfflineData().then(() => logout());
              })
            }
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
