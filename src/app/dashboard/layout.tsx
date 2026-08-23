import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ReceiptText } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyName } from "@/lib/volunteer-names";
import { todayInIst, volunteerName } from "@/lib/receipt-utils";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, SidebarNav } from "./sidebar-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { NotificationBell } from "./notification-bell";
import type { Receipt } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // proxy.ts is an optimistic gate only — re-verify on the server.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = todayInIst();

  const [{ locale, t }, myName, { data: dueToday }] = await Promise.all([
    getDictionary(),
    getMyName(),
    // Pledges due exactly today, for the bell — overdue-but-older pledges
    // already had their day and don't need to keep re-alerting.
    supabase
      .from("receipts")
      .select("*")
      .eq("payment_status", "Unpaid")
      .eq("due_on", today)
      .order("amount", { ascending: false }),
  ]);

  return (
    <I18nProvider locale={locale}>
      <ServiceWorkerRegistrar />
      <div className="flex min-h-full flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 print:hidden">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
            <div className="brand-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
              <ReceiptText className="size-4.5" />
            </div>
            <div className="mr-auto min-w-0">
              <p className="truncate font-display text-[0.95rem] leading-tight font-semibold tracking-tight">
                {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
              </p>
              {/* The name doubles as the way into the one setting there is. */}
              <Link
                href="/dashboard/settings"
                title={t("nav.settings")}
                className="block truncate text-xs text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
              >
                {myName ?? volunteerName(user.email) ?? user.email}
              </Link>
            </div>
            <RealtimeRefresh />
            <NotificationBell dueToday={(dueToday ?? []) as Receipt[]} />
            <ThemeToggle />
            <LanguageToggle locale={locale} />
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut />
                <span className="hidden sm:inline">{t("auth.logout")}</span>
              </Button>
            </form>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1">
          <SidebarNav />
          <main className="min-w-0 flex-1 p-3 sm:p-4">{children}</main>
        </div>

        <BottomNav />
      </div>
    </I18nProvider>
  );
}
