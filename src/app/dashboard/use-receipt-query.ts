"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toSearchParams, type ReceiptQuery } from "./receipts-query";

/**
 * Writes a change to one of the four controls back into the URL.
 *
 * `replace`, not `push`: the controls are a view of the same page, so the back
 * button should mean "the page before this one" rather than "the previous sort
 * I tried". `scroll: false` because re-sorting should not throw the volunteer
 * back to the top of a list they were part-way down.
 */
export function useReceiptQueryNav(query: ReceiptQuery) {
  const router = useRouter();
  const pathname = usePathname();

  return React.useCallback(
    (patch: Partial<ReceiptQuery>) => {
      const params = new URLSearchParams(toSearchParams({ ...query, ...patch }));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, router, pathname],
  );
}
