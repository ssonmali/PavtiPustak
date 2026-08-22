"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import {
  requestPasswordReset,
  type ResetState,
} from "@/app/actions/auth";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <Fields />
    </I18nProvider>
  );
}

function Fields() {
  const { t } = useI18n();
  const [state, action, pending] = React.useActionState<ResetState, FormData>(
    requestPasswordReset,
    { error: null },
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* The action needs an absolute origin to build the callback URL. */}
      <input
        type="hidden"
        name="origin"
        value={typeof window === "undefined" ? "" : window.location.origin}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state.sent ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {t("reset.sent")}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Mail />}
        {t("reset.send")}
      </Button>
    </form>
  );
}
