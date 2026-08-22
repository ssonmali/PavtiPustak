"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePassword, type UpdatePasswordState } from "@/app/actions/auth";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <Fields />
    </I18nProvider>
  );
}

function Fields() {
  const { t } = useI18n();
  const [state, action, pending] = React.useActionState<
    UpdatePasswordState,
    FormData
  >(updatePassword, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("reset.newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t("reset.confirmPassword")}</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {t("reset.save")}
      </Button>
    </form>
  );
}
