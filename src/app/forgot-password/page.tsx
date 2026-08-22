import Link from "next/link";
import { ReceiptText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./form";

export const metadata = { title: "Reset password · Pavti Pustak" };

export default async function ForgotPasswordPage() {
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
            <CardTitle>{t("reset.requestTitle")}</CardTitle>
            <CardDescription>{t("reset.requestBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm locale={locale} />
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
