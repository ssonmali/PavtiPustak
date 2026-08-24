import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./form";

export const metadata = { title: "Reset password · SGMM Pustak" };

export default async function ForgotPasswordPage() {
  const { locale, t } = await getDictionary();

  return (
    <main className="app-surface flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image
            src="/idol.jpg"
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-2xl object-cover"
          />
          <h1 className="font-display text-2xl tracking-tight">
            {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
          </h1>
        </div>

        <Card className="card-elevated accent-top">
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
