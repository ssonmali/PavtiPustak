import { createClient } from "@/lib/supabase/server";
import { getVolunteerNames } from "@/lib/volunteer-names";
import type { AuditEntry } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityList } from "./activity-list";

export const metadata = { title: "Activity · Pavti Pustak" };

export default async function ActivityPage() {
  const supabase = await createClient();
  const names = await getVolunteerNames();

  // Newest first, capped — the log grows forever and nobody scrolls past 200.
  const { data, error } = await supabase
    .from("receipt_audit")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load the activity log: {error.message}. Have you run
            supabase/02-audit-and-shared-editing.sql?
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ActivityList entries={(data ?? []) as AuditEntry[]} names={names} />
  );
}
