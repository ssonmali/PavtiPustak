"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
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
  const [visible, setVisible] = useState(false);

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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            // The label says what the button will do, not the current state,
            // and it is announced rather than left as a bare icon.
            aria-label={t(visible ? "auth.hidePassword" : "auth.showPassword")}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

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
