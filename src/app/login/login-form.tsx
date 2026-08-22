"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LoginForm({ next, locale }: { next?: string; locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <Fields next={next} />
    </I18nProvider>
  );
}

function Fields({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="volunteer@mandal.org"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <a
        href="/forgot-password"
        className="self-start text-xs text-muted-foreground underline"
      >
        {t("reset.forgot")}
      </a>

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> {t("auth.submitting")}
          </>
        ) : (
          <>
            <KeyRound /> {t("auth.submit")}
          </>
        )}
      </Button>
    </form>
  );
}
