import { createClient } from "@/lib/supabase/server";
import type { Receipt } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptsView } from "./receipts-view";

export const metadata = { title: "Receipts · Pavti Pustak" };

export default async function ReceiptsPage() {
  const supabase = await createClient();
  // First page only; the client appends further pages on demand.
  const { data, error, count } = await supabase
    .from("receipts")
    .select("*", { count: "exact" })
    .order("collection_date", { ascending: false })
    .order("receipt_number", { ascending: false })
    .range(0, 49);

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
    />
  );
}
