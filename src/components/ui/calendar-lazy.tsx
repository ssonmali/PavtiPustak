"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * The date picker, loaded on first open instead of on page load.
 *
 * `react-day-picker` and the `date-fns` locale data it pulls in are ~23 KB
 * gzipped, and every calendar in the app sits inside a popover inside a closed
 * dialog — so on the dashboard, receipts and expenses routes that was 23 KB
 * spent up front, on a volunteer's mobile data, for a control most sessions
 * never open. Deferring it costs a spinner on the first tap.
 *
 * `next/dynamic` only code-splits when the importer is itself a Client
 * Component (see next/dist/docs/01-app/02-guides/lazy-loading.md); all three
 * dialogs are, which is why the split lives here rather than at their pages.
 *
 * Same props as `Calendar` — this is a drop-in replacement for it.
 */
export const Calendar = dynamic(
  () => import("@/components/ui/calendar").then((m) => m.Calendar),
  {
    ssr: false,
    // Sized to a month grid so the popover does not resize under the finger
    // when the real calendar arrives.
    loading: () => (
      <div
        className="flex h-[19.5rem] w-[17.5rem] items-center justify-center"
        role="status"
        aria-label="Loading calendar"
      >
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    ),
  },
);
