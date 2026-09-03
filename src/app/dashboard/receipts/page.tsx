import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getPledgeDays } from "@/lib/pledge-days";
import { getMyName, getVolunteerNames } from "@/lib/volunteer-names";
import { volunteerName } from "@/lib/receipt-utils";
import type { DailyTotal, Receipt } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_LIMIT,
  applyReceiptQuery,
  parseReceiptQuery,
} from "../receipts-query";
import { ReceiptsView } from "./receipts-view";

export const metadata = { title: "Receipts · SGMM Pustak" };

export default async function ReceiptsPage({
  searchParams,
}: {
  // Typed explicitly, matching report/page.tsx: the generated PageProps helper
  // only knows routes that existed when types were last written.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  // The four controls live in the URL, so the first paint is already sorted
  // and filtered — no client round trip, and no flash of newest-first before
  // the real order arrives.
  const query = parseReceiptQuery(await searchParams);

  const [{ data, error, count }, myName, user, names, daily, pledgeDays] =
    await Promise.all([
      // First page only; the client appends further pages on demand, through
      // the same query so the pages belong to the same result.
      applyReceiptQuery(
        supabase.from("receipts").select("*", { count: "exact" }),
        query,
      ).range(0, DEFAULT_LIMIT - 1),
      getMyName(),
      getViewer(),
      getVolunteerNames(),
      supabase
        .from("receipt_daily_totals")
        .select("*")
        .order("collection_date", { ascending: false })
        .limit(400),
      // Aggregated by day, and shared with the overview, which asks the same
      // question — see lib/pledge-days.ts.
      getPledgeDays(),
    ]);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load receipts: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ReceiptsView
      receipts={(data ?? []) as Receipt[]}
      total={count ?? 0}
      query={query}
      mandalName={process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
      // The name other volunteers see when this device has a receipt open.
      myName={myName ?? volunteerName(user?.email) ?? "—"}
      names={names}
      daily={(daily.data ?? []) as DailyTotal[]}
      pledgeDays={pledgeDays}
    />
  );
}
