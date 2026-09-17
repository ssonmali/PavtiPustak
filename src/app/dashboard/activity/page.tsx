import { createClient } from "@/lib/supabase/server";
import { getVolunteerNames } from "@/lib/volunteer-names";
import type { ActivityEntry } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityList } from "./activity-list";

export const metadata = { title: "Activity · SGMM Pustak" };

export default async function ActivityPage() {
  const supabase = await createClient();
  const names = await getVolunteerNames();

  // Newest first, capped — the log grows forever and nobody scrolls past 200.
  // activity_log unions the receipt and expense audit tables (migration 09).
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load the activity log: {error.message}. Have you run
            supabase/02-audit-and-shared-editing.sql and
            supabase/09-expense-audit.sql?
          </p>
        </CardContent>
      </Card>
    );
  }

  const entries = (data ?? []) as ActivityEntry[];

  /*
   * Which deleted receipts are back already.
   *
   * The audit log is append-only, so a deletion stays in the feed forever —
   * including after someone restores it. Without this the Restore button sat
   * there on an entry that had nothing left to restore: tapping it was
   * harmless (the action answers "already-exists") but the button was still
   * claiming an action that was no longer available.
   *
   * One query, and only for the deletions in the page of entries just
   * fetched, so it stays a couple of dozen ids at most.
   */
  const deletedIds = [
    ...new Set(
      entries
        .filter((e) => e.entity === "receipt" && e.action === "deleted")
        .map((e) => e.row_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let liveIds: string[] = [];
  if (deletedIds.length > 0) {
    const { data: live } = await supabase
      .from("receipts")
      .select("id")
      .in("id", deletedIds);
    liveIds = (live ?? []).map((r) => r.id);
  }

  return (
    <ActivityList entries={entries} names={names} liveIds={liveIds} />
  );
}
