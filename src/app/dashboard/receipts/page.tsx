import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getMyName, getVolunteerNames } from "@/lib/volunteer-names";
import { volunteerName } from "@/lib/receipt-utils";
import type { DailyTotal, Receipt } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptsView } from "./receipts-view";

export const metadata = { title: "Receipts · SGMM Pustak" };

export default async function ReceiptsPage() {
  const supabase = await createClient();

  const [{ data, error, count }, myName, user, names, daily, unpaidRows] =
    await Promise.all([
      // First page only; the client appends further pages on demand.
      supabase
        .from("receipts")
        .select("*", { count: "exact" })
        .order("collection_date", { ascending: false })
        .order("receipt_number", { ascending: false })
        .range(0, 49),
      getMyName(),
      getUser(),
      getVolunteerNames(),
      supabase
        .from("receipt_daily_totals")
        .select("*")
        .order("collection_date", { ascending: false })
        .limit(400),
      supabase
        .from("receipts")
        .select("amount, collection_date")
        .eq("payment_status", "Unpaid")
        .limit(1000),
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
      mandalName={process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
      // The name other volunteers see when this device has a receipt open.
      myName={myName ?? volunteerName(user?.email) ?? "—"}
      names={names}
      daily={(daily.data ?? []) as DailyTotal[]}
      unpaid={(unpaidRows.data ?? []) as { amount: number; collection_date: string }[]}
    />
  );
}
