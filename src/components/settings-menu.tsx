"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Flame,
  ImagePlus,
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
import { BackgroundCropper } from "@/components/background-cropper";
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
  const [bgOpen, setBgOpen] = React.useState(false);

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

          {/*
            * With the theme, because that is what it changes — and ABOVE the
            * language and account groups because of where it ends up on a
            * short screen.
            *
            * This menu is thirteen rows. Its popup is height-capped with
            * overflow-y: auto, so on a 333px-tall viewport it renders 40..328
            * and anything below that is reachable only by scrolling inside the
            * menu, which nothing advertises. Measured: as the last-but-one item
            * this sat at 335..363 — off the end, which is exactly the "I cannot
            * see it" that sent me looking.
            *
            * Outside the radio group above rather than in it: that group is a
            * set of mutually exclusive choices that apply on the tap, and an
            * item which opens a dialog does not belong to it either
            * semantically or for a screen reader.
            */}
          <DropdownMenuItem onClick={() => setBgOpen(true)}>
            <ImagePlus /> {t("wallpaper.title")}
          </DropdownMenuItem>

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

      {/* Scrollable: the cropper is a 280px frame plus a zoom slider and three
          buttons, which is taller than a phone's visual viewport once the
          dialog's own padding is counted. max-h-visual is the app's
          keyboard-aware height — see MobileKeyboard. */}
      <Dialog open={bgOpen} onOpenChange={setBgOpen}>
        <DialogContent className="max-h-visual overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wallpaper.title")}</DialogTitle>
            <DialogDescription>{t("wallpaper.menuHint")}</DialogDescription>
          </DialogHeader>
          <BackgroundCropper hideHeading onDone={() => setBgOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
