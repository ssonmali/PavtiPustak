import { createClient } from "@/lib/supabase/server";
import { getMyName } from "@/lib/volunteer-names";
import { getDictionary } from "@/lib/i18n/server";
import { volunteerName } from "@/lib/receipt-utils";
import { Card, CardContent } from "@/components/ui/card";
import { NameForm } from "@/components/name-form";

export const metadata = { title: "Your name · Pavti Pustak" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    name,
  ] = await Promise.all([supabase.auth.getUser(), getMyName()]);

  const { t } = await getDictionary();
  const email = user?.email ?? "";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>

      <Card className="card-elevated">
        <CardContent>
          <NameForm
            name={name}
            email={email}
            // What the app falls back to, so the placeholder shows what happens
            // if the field is left blank rather than an unrelated example name.
            derived={volunteerName(email) ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
