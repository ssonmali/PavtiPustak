import { createClient } from "@/lib/supabase/server";
import { getVolunteerNames } from "@/lib/volunteer-names";
import { todayInIst } from "@/lib/receipt-utils";
import type {
  DailyTotal,
  Donation,
  ExpenseDailyTotal,
  PledgeTotals,
  Receipt,
  VolunteerTotal,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Overview } from "./overview";

export const metadata = { title: "Overview · SGMM Pustak" };

export default async function DashboardPage() {
  const supabase = await createClient();

  // Aggregates come from views, so the dashboard stays a few hundred bytes
  // whether the mandal has 50 receipts or 50,000.
  const [daily, volunteers, expenses, pledges, unpaidRows, due, donations, names] =
    await Promise.all([
    supabase
      .from("receipt_daily_totals")
      .select("*")
      .order("collection_date", { ascending: false })
      .limit(400),
    supabase
      .from("volunteer_totals")
      .select("*")
      .order("total", { ascending: false }),
    supabase
      .from("expense_daily_totals")
      .select("*")
      .order("spent_on", { ascending: false })
      .limit(400),
    supabase.from("pledge_totals").select("*").maybeSingle(),
    // Just the two columns needed to total pledges per period. Fetched as rows
    // rather than a view because pledges are few by nature — a promise that is
    // never collected gets marked paid or deleted, so this does not grow like
    // the ledger does.
    supabase
      .from("receipts")
      .select("amount, collection_date")
      .eq("payment_status", "Unpaid")
      .limit(1000),
    // The reminder list: promised, and due today or already late. Capped
    // because this is a to-do list, not a ledger view.
    supabase
      .from("receipts")
      .select("*")
      .eq("payment_status", "Unpaid")
      .lte("due_on", todayInIst())
      .order("due_on", { ascending: true })
      .limit(50),
    // A low-volume log by nature — the whole box, newest first.
    supabase
      .from("donations")
      .select("*")
      .order("donation_date", { ascending: false })
      .order("donation_number", { ascending: false })
      .limit(500),
    getVolunteerNames(),
  ]);

  // Expenses are additive: migration 08 may not be applied yet, and the rest
  // of the dashboard should still render if it is not.
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
      expenseDays={(expenses.data ?? []) as ExpenseDailyTotal[]}
      pledges={(pledges.data as PledgeTotals | null) ?? null}
      unpaidDays={
        (unpaidRows.data ?? []) as { amount: number; collection_date: string }[]
      }
      due={(due.data ?? []) as Receipt[]}
      donations={(donations.data ?? []) as Donation[]}
      mandalName={process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
      names={names}
    />
  );
}
