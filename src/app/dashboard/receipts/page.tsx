import { createClient } from "@/lib/supabase/server";
import type { Receipt } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptsView } from "./receipts-view";

export const metadata = { title: "Receipts · Pavti Pustak" };

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: false })
    .order("receipt_number", { ascending: false });

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
      mandalName={process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal"}
    />
  );
}
