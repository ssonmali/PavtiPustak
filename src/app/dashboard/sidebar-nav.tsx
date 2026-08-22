"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Printer, ReceiptText } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/dashboard/receipts", labelKey: "nav.receipts", icon: ReceiptText },
  { href: "/dashboard/activity", labelKey: "nav.activity", icon: Activity },
  { href: "/dashboard/report", labelKey: "nav.report", icon: Printer },
] as const;

/** Vertical rail, shown from md up. */
export function SidebarNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-sidebar/60 p-3 md:flex print:hidden">
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
                alone — the label is also emphasised. */}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[image:var(--brand-gradient)]"
              />
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
    <nav className="sticky bottom-0 z-10 flex border-t bg-background/90 backdrop-blur-md md:hidden print:hidden">
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
            {active ? (
              <span
                aria-hidden
                className="absolute top-0 h-0.5 w-8 rounded-full bg-[image:var(--brand-gradient)]"
              />
            ) : null}
            <Icon className="size-5" />
            <span className="truncate px-1">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
