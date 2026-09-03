"use client";

import { ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Download,
  LayoutDashboard,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/dashboard/receipts", labelKey: "nav.receipts", icon: ReceiptText },
  { href: "/dashboard/expenses", labelKey: "nav.expenses", icon: Wallet },
  { href: "/dashboard/activity", labelKey: "nav.activity", icon: Activity },
  /* Same route as ever — /dashboard/report still renders the printable
     report. Only the label and the icon changed: the page is where a
     treasurer takes the ledger out of the app, and "Export" is what they are
     looking for when they go there. */
  { href: "/dashboard/report", labelKey: "nav.report", icon: Download },
] as const;

/** Vertical rail, shown from md up. */
export function SidebarNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="glass-bar hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex print:hidden">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all",
              active
                ? "bg-accent font-medium text-accent-foreground shadow-[var(--elevation-sm)]"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {/* A saffron bar marks the current page without relying on colour
                alone — the label is also emphasised.

                Wrapped in a ViewTransition so it SLIDES from the old tab to
                the new one instead of vanishing here and appearing there.
                Only one link is active at a time, so React sees the same name
                on both sides of the navigation and morphs one element between
                two positions — which is the thing that reads as "I moved down
                the list" rather than as two separate marks blinking.

                The name differs from the bottom bar's on purpose: both navs
                are in the DOM at every width, only hidden by a breakpoint, and
                two elements sharing a view-transition-name is undefined
                behaviour rather than a nicer animation.

                default="none" keeps it still during every OTHER transition —
                without it this would animate on each router.refresh() from the
                realtime safety net, which is a mark twitching for no reason a
                volunteer can see. With default="none" the explicit share is
                required; drop it and the pair silently stops morphing. */}
            {active ? (
              <ViewTransition name="nav-marker-rail" share="nav-marker" default="none">
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[image:var(--brand-gradient)]"
                />
              </ViewTransition>
            ) : null}
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Thumb-reachable bottom tabs, the same destinations, below md. */
export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="glass-bar sticky bottom-0 z-10 flex border-t md:hidden print:hidden">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
              active ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {/* The same morph as the rail's, along the other axis: here the
                mark travels sideways between tabs. See the note there. */}
            {active ? (
              <ViewTransition name="nav-marker-tabs" share="nav-marker" default="none">
                <span
                  aria-hidden
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-[image:var(--brand-gradient)]"
                />
              </ViewTransition>
            ) : null}
            <Icon className="size-5" />
            <span className="truncate px-1">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
