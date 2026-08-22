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
    <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r p-3 md:flex print:hidden">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
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
    <nav className="sticky bottom-0 z-10 flex border-t bg-background md:hidden print:hidden">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
              active ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="truncate px-1">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
