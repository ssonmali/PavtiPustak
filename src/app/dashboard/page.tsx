import { createClient } from "@/lib/supabase/server";
import type { DailyTotal, VolunteerTotal } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Overview } from "./overview";

export const metadata = { title: "Overview · Pavti Pustak" };

export default async function DashboardPage() {
  const supabase = await createClient();

  // Aggregates come from views, so the dashboard stays a few hundred bytes
  // whether the mandal has 50 receipts or 50,000.
  const [daily, volunteers] = await Promise.all([
    supabase
      .from("receipt_daily_totals")
      .select("*")
      .order("collection_date", { ascending: false })
      .limit(400),
    supabase
      .from("volunteer_totals")
      .select("*")
      .order("total", { ascending: false }),
  ]);

  const error = daily.error ?? volunteers.error;
  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load totals: {error.message}. Have you run
            supabase/04-views-and-locking.sql?
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Overview
      daily={(daily.data ?? []) as DailyTotal[]}
      volunteers={(volunteers.data ?? []) as VolunteerTotal[]}
    />
  );
}
