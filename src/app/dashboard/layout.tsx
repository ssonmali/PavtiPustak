import { redirect } from "next/navigation";
import Image from "next/image";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyName } from "@/lib/volunteer-names";
import { todayInIst, volunteerName } from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { SettingsMenu } from "@/components/settings-menu";
import { BottomNav, SidebarNav } from "./sidebar-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { NotificationBell } from "./notification-bell";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const today = todayInIst();

  // All four together rather than the auth check first: proxy.ts has already
  // gated this path, so waiting on a second validation before even starting the
  // other reads added a round-trip to every dashboard load. getMyName() shares
  // the same cached user, so this is still one validation.
  const [user, { locale }, myName, { data: dueToday }] = await Promise.all([
    getUser(),
    getDictionary(),
    getMyName(),
    // Pledges due exactly today, for the bell — overdue-but-older pledges
    // already had their day and don't need to keep re-alerting.
    // Three columns rather than `*`: this runs on every dashboard page and
    // every refresh, and the bell renders nothing else. No limit, though — the
    // badge shows a count, so a cap here would quietly under-report it.
    supabase
      .from("receipts")
      .select("id, donor_name, amount")
      .eq("payment_status", "Unpaid")
      .eq("due_on", today)
      .order("amount", { ascending: false }),
  ]);

  // proxy.ts is an optimistic gate only — this is the authoritative check.
  if (!user) redirect("/login");

  return (
    <I18nProvider locale={locale}>
      <ServiceWorkerRegistrar />
      <div className="flex min-h-full flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 print:hidden">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
            <Image
              src="/idol.jpg"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-xl object-cover"
            />
            <div className="mr-auto min-w-0">
              <p className="truncate font-display text-[0.95rem] leading-tight font-semibold tracking-tight">
                {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {myName ?? volunteerName(user.email) ?? user.email}
              </p>
            </div>
            <RealtimeRefresh />
            <NotificationBell dueToday={dueToday ?? []} />
            <SettingsMenu
              locale={locale}
              name={myName}
              email={user.email ?? ""}
              derivedName={volunteerName(user.email) ?? ""}
            />
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
