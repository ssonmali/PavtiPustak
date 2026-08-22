import { CalendarDays, IndianRupee, Receipt, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Receipt as ReceiptRow } from "@/lib/types";
import { formatAmount, toDateValue } from "@/lib/receipt-utils";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyCollections } from "./daily-collections";
import { ReceiptsTable } from "./receipts-table";

export const metadata = { title: "Dashboard · Pavti Pustak" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { locale, t } = await getDictionary();

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("collection_date", { ascending: false })
    .order("receipt_number", { ascending: false });

  const receipts: ReceiptRow[] = data ?? [];
  const total = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const donors = new Set(receipts.map((r) => r.donor_name.trim().toLowerCase()));
  const today = toDateValue(new Date());
  const todayTotal = receipts
    .filter((r) => r.collection_date === today)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const stats = [
    { label: t("stats.total"), value: formatAmount(total), icon: IndianRupee },
    { label: t("stats.today"), value: formatAmount(todayTotal), icon: CalendarDays },
    { label: t("stats.receipts"), value: String(receipts.length), icon: Receipt },
    { label: t("stats.donors"), value: String(donors.size), icon: Users },
  ];

  return (
    <I18nProvider locale={locale}>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("table.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("table.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <Icon className="size-3.5" /> {label}
                </CardDescription>
                <CardTitle className="text-xl tabular-nums sm:text-2xl">
                  {value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {error ? (
          <Card>
            <CardContent>
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Could not load receipts: {error.message}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("chart.title")}</CardTitle>
                <CardDescription>{t("chart.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyCollections receipts={receipts} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <ReceiptsTable
                  receipts={receipts}
                  mandalName={
                    process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal"
                  }
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </I18nProvider>
  );
}
