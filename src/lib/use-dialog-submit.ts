"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dictionaries";

/**
 * What every write action in this app can answer. The receipt actions add a
 * `duplicate` arm on top; this type deliberately does not know about it, so
 * callers that can receive one handle it themselves through `onOther`.
 */
export type WriteResult =
  | { ok: true }
  | { ok: false; conflict: true }
  | { ok: false; error: string }
  | { ok: false; [key: string]: unknown };

type Options = {
  /** Shown on success. The receipt dialog varies it by create-vs-edit. */
  success: MessageKey | (() => string);
  /** Shown when the row moved underneath us. */
  conflict: MessageKey;
  /** Closes the dialog. Called on success and on conflict, never on error. */
  close: () => void;
  /**
   * Last resort, for arms this hook does not model — the receipt dialog's
   * `duplicate`. Return true to say "handled, stop here"; anything else falls
   * through to conflict and then to showing `result.error`. Given the
   * FormData because the duplicate prompt has to be able to resubmit it.
   */
  onOther?: (
    result: { ok: false } & Record<string, unknown>,
    formData: FormData,
  ) => boolean;
  /**
   * Offered the FormData before the network is touched, and again if the
   * request throws. Returning true means the write was stored locally and the
   * caller is done. This is the offline outbox in the receipt dialog.
   */
  queueLocally?: (formData: FormData) => Promise<boolean>;
  /** False when the device is known to be offline: queue without trying. */
  online?: boolean;
};

/**
 * The save pipeline the three entry dialogs were each hand-rolling.
 *
 * They had drifted, which is the reason this exists rather than a tidiness
 * argument: the router.refresh() that stops Save spinning had been added to
 * the receipt dialog and to neither of the others, so the same reported bug
 * was still live in two of three places. One pipeline, one place to fix.
 *
 * The refresh is deliberately AFTER close and NOT awaited. The actions no
 * longer call refresh() themselves because that re-renders the route inside
 * the action's own response, which kept the button spinning long after the
 * row was written — see the note in actions/receipts.ts.
 */
export function useDialogSubmit({
  success,
  conflict,
  close,
  onOther,
  queueLocally,
  online = true,
}: Options) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const submit = React.useCallback(
    async (formData: FormData, run: (formData: FormData) => Promise<WriteResult>) => {
      // Known offline: do not even attempt the request.
      if (!online && queueLocally && (await queueLocally(formData))) return;

      setPending(true);
      let result: WriteResult;
      try {
        result = await run(formData);
      } catch {
        // navigator.onLine lies — a captive portal or a dropped connection
        // looks online right up until the request fails. Falling back here is
        // what makes saving reliable, rather than the flag being correct.
        setPending(false);
        if (queueLocally && (await queueLocally(formData))) return;
        toast.error(t("error.body"));
        return;
      }
      setPending(false);

      if (result.ok) {
        toast.success(typeof success === "function" ? success() : t(success));
        close();
        router.refresh();
        return;
      }
      if (
        onOther?.(
          result as { ok: false } & Record<string, unknown>,
          formData,
        )
      )
        return;
      if ("conflict" in result) {
        toast.error(t(conflict));
        close();
        return;
      }
      toast.error(
        typeof result.error === "string" ? result.error : t("error.body"),
      );
    },
    [online, queueLocally, t, success, close, router, onOther, conflict],
  );

  return { pending, submit };
}
