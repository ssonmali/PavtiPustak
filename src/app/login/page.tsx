import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "./login-form";

export const metadata = { title: "Login · SGMM Pustak" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
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
            priority
          />
          <h1 className="font-display text-2xl tracking-tight">
            {process.env.NEXT_PUBLIC_MANDAL_NAME ?? "Shri Ganesh Mitra Mandal"}
          </h1>
          <p className="text-sm text-muted-foreground">{t("auth.bookName")}</p>
        </div>

        <Card className="card-elevated accent-top">
          <CardHeader>
            <CardTitle>{t("auth.signIn")}</CardTitle>
            <CardDescription>{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              next={typeof next === "string" ? next : undefined}
              locale={locale}
            />
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-center">
          <LanguageToggle locale={locale} />
        </div>
      </div>
    </main>
  );
}
