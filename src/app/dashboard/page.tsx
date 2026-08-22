import { createClient } from "@/lib/supabase/server";
import type { Receipt as ReceiptRow } from "@/lib/types";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardView } from "./dashboard-view";

export const metadata = { title: "Dashboard · Pavti Pustak" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { locale } = await getDictionary();

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: false })
    .order("receipt_number", { ascending: false });

  const receipts: ReceiptRow[] = data ?? [];

  return (
    <I18nProvider locale={locale}>
      {error ? (
        <Card>
          <CardContent>
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Could not load receipts: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DashboardView
          receipts={receipts}
          mandalName={process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal"}
        />
      )}
    </I18nProvider>
  );
}
