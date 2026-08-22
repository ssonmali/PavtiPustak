import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";
import { ResetPasswordForm } from "./form";

export const metadata = { title: "New password · Pavti Pustak" };

export default async function ResetPasswordPage() {
  // Reachable only with the recovery session set by /auth/confirm.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  const { locale, t } = await getDictionary();

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ReceiptText className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Ganesh Mandal"}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("reset.newTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm locale={locale} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
