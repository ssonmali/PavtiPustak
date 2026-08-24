import { createClient } from "@/lib/supabase/server";
import { getVolunteerNames } from "@/lib/volunteer-names";
import type { Expense } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ExpensesView } from "./expenses-view";

export const metadata = { title: "Expenses · SGMM Pustak" };

/** Generous for a mandal, but the cap is surfaced rather than silent. */
const MAX_ROWS = 1000;

export default async function ExpensesPage() {
  const supabase = await createClient();

  const [{ data, error }, names] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    getVolunteerNames(),
  ]);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load expenses: {error.message}. Have you run
            supabase/08-expenses.sql?
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ExpensesView
      expenses={(data ?? []) as Expense[]}
      names={names}
      truncated={(data?.length ?? 0) === MAX_ROWS ? MAX_ROWS : undefined}
    />
  );
}
