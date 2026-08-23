"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveMyName } from "@/app/actions/volunteer-names";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The one field there is. Deliberately unwrapped — the settings page puts it in
 * a card, the header menu puts it in a dialog, and neither needs its own copy
 * of the save logic.
 */
export function NameForm({
  name,
  email,
  derived,
  onSaved,
}: {
  /** The name already saved, or null when none is set. */
  name: string | null;
  email: string;
  derived: string;
  /** Called after a successful save, so a dialog host can close itself. */
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    const wasBlank =
      String(formData.get("display_name") ?? "").trim().length === 0;

    let result;
    try {
      result = await saveMyName(formData);
    } catch {
      setSaving(false);
      toast.error(t("settings.failed"));
      return;
    }
    setSaving(false);

    if (!result.ok) {
      toast.error(
        result.error === "too-long"
          ? t("settings.tooLong")
          : t("settings.failed"),
      );
      return;
    }
    toast.success(wasBlank ? t("settings.cleared") : t("settings.saved"));
    onSaved?.();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display_name">{t("settings.label")}</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={name ?? ""}
          placeholder={derived || t("settings.placeholder")}
          maxLength={60}
          autoComplete="name"
        />
        <p className="text-xs text-muted-foreground">{t("settings.hint")}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t("settings.save")}
        </Button>
        <p className="wrap-anywhere min-w-0 text-xs text-muted-foreground">
          {t("settings.signedInAs", { email })}
        </p>
      </div>
    </form>
  );
}
