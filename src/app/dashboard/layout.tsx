import { redirect } from "next/navigation";
import { LogOut, ReceiptText } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { LanguageToggle } from "@/components/language-toggle";
import { BottomNav, SidebarNav } from "./sidebar-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { ServiceWorkerRegistrar } from "@/components/service-worker";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // proxy.ts is an optimistic gate only — re-verify on the server.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { locale, t } = await getDictionary();

  return (
    <I18nProvider locale={locale}>
      <ServiceWorkerRegistrar />
      <div className="flex min-h-full flex-1 flex-col bg-muted/40">
        <header className="sticky top-0 z-20 border-b bg-background print:hidden">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ReceiptText className="size-4" />
            </div>
            <div className="mr-auto min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <RealtimeRefresh />
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
