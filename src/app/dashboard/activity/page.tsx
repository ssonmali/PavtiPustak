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

  return (
    <ActivityList entries={(data ?? []) as ActivityEntry[]} names={names} />
  );
}
