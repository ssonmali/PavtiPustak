import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const { t } = await getDictionary();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <FileQuestion className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">{t("notFound.title")}</p>
          <p className="text-sm text-muted-foreground">{t("notFound.body")}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>{t("error.home")}</Button>
      </div>
    </main>
  );
}
