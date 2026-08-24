"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

/** A receipt id in a path, e.g. /dashboard/receipts/8f14e45f-…-b3f2 */
const RECEIPT_PATH =
  /^\/dashboard\/receipts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Page views, with the printed-slip route collapsed to its pattern.
 *
 * Two reasons, and the second is the one that matters. Sending the id would
 * make every receipt its own row, so the report would be thousands of
 * one-view lines instead of a usable "how often is a slip printed" figure. And
 * a receipt id is a handle to a named contributor's record: it identifies no
 * one on its own, but it is not ours to hand to a third party either, and
 * nothing here needs it.
 *
 * The report's query string is deliberately kept — from/to/status/sort say
 * which reports volunteers actually print, and none of it names anybody.
 *
 * Its own client component because `beforeSend` is a function prop, which a
 * Server Component cannot pass. Marking the root layout "use client" instead
 * would take `metadata` and `viewport` with it.
 */
export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        const url = new URL(event.url);
        if (RECEIPT_PATH.test(url.pathname)) {
          url.pathname = "/dashboard/receipts/[id]";
          return { ...event, url: url.toString() };
        }
        return event;
      }}
    />
  );
}
