import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getViewer } from "@/lib/auth";
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
  // the same cached viewer, so this is still one verification — and since that
  // verification is now local (see getViewer), getMyName's own query no longer
  // waits on a network hop before it can start.
  const [user, { locale }, myName, { data: dueToday }] = await Promise.all([
    getViewer(),
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

  /*
   * Both this and proxy.ts now verify the signature locally, so neither is a
   * revocation check: a valid signature stays valid until the token expires.
   * That is a deliberate trade and the reasoning — including what still DOES
   * catch a disabled account, which is every Server Action — is written out in
   * lib/auth.ts. Read it before turning this back into a getUser().
   *
   * This redirect still matters: the proxy gates /dashboard on the request,
   * but a route can also be reached with a cookie that expired between the two,
   * and rendering the shell for nobody is not something to leave possible.
   */
  if (!user) redirect("/login");

  return (
    <I18nProvider locale={locale}>
      <ServiceWorkerRegistrar />
      {/* Lamplight on the Devasthan backdrop: a halo behind the balance card
          in Day, three diya sparks in Night, and nothing at all in the other
          two themes (globals.css hides the whole layer). Four empty spans, so
          rendering them unconditionally is cheaper than making the dashboard
          shell care which theme is active — which it cannot know on the
          server anyway, and guessing is a hydration mismatch. */}
      <div aria-hidden data-devasthan-decor>
        <span className="devasthan-halo" />
        <span className="devasthan-spark devasthan-spark--1" />
        <span className="devasthan-spark devasthan-spark--2" />
        <span className="devasthan-spark devasthan-spark--3" />
      </div>

      <div className="flex min-h-full flex-1 flex-col">
        <header className="glass-bar sticky top-0 z-20 border-b print:hidden">
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
          {/*
            * The skeleton hands over to the content instead of being swapped
            * for it in one frame.
            *
            * Every route here has a loading.tsx, so a tab tap paints a
            * skeleton and then replaces it the instant the data lands. That
            * replacement was a hard cut — the more so now that the data
            * arrives quickly, because a skeleton that appears and vanishes
            * within a few frames reads as a flash rather than as loading.
            *
            * Wrapped once here rather than in each of the five loading.tsx
            * files and their five pages. That is not only less code: the
            * animation is a property of "the main area is changing", and
            * putting it in ten places is ten places for it to drift.
            *
            * default="none" for the same reason as the nav marker — this must
            * not animate on the timed router.refresh() from the realtime
            * safety net, which changes the content underneath without any
            * navigation and would otherwise dissolve the page a volunteer is
            * reading.
            *
            * The keyframes are opacity and transform only. The stock enter/
            * exit ones animate `filter`, and this subtree is full of surfaces
            * carrying backdrop-filter — that exact combination is what caused
            * the filter sheet to flicker on dismiss.
            */}
          <main className="min-w-0 flex-1 p-3 sm:p-4">
            <ViewTransition enter="main-enter" exit="main-exit" default="none">
              {children}
            </ViewTransition>
          </main>
        </div>

        <BottomNav />
      </div>
    </I18nProvider>
  );
}
