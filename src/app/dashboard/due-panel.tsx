"use client";

import * as React from "react";
import { BellRing, Check, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { markReceiptPaid } from "@/app/actions/receipts";
import { useI18n } from "@/lib/i18n/client";
import {
  formatAmount,
  formatDate,
  pledgeReminderUrl,
  todayInIst,
} from "@/lib/receipt-utils";
import { PAYMENT_METHODS, type PaymentMethod, type Receipt } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The reminder. Pledges due today or already overdue, at the top of the
 * dashboard — the volunteer is told when they open the app, which is the whole
 * mechanism, so it renders nothing when there is nothing to chase rather than
 * sitting there as a permanent empty box.
 */
export function DuePanel({
  pledges,
  mandalName,
}: {
  /** Unpaid receipts due today or earlier, soonest first. */
  pledges: Receipt[];
  mandalName: string;
}) {
  const { t, locale } = useI18n();
  const [paying, setPaying] = React.useState<string | null>(null);
  const [toMarkPaid, setToMarkPaid] = React.useState<Receipt | undefined>();

  if (pledges.length === 0) return null;

  const today = todayInIst();
  const total = pledges.reduce((sum, p) => sum + Number(p.amount), 0);

  async function markPaid(receipt: Receipt, method: PaymentMethod) {
    setPaying(receipt.id);
    let result;
    try {
      result = await markReceiptPaid(receipt.id, method);
    } catch {
      setPaying(null);
      toast.error(t("error.body"));
      return;
    }
    setPaying(null);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("toast.conflict"));
      return;
    }
    toast.success(t("status.markedPaid"));
  }

  return (
    <Card className="card-elevated accent-top border-pending/30 [--accent-line:var(--pending)]">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-pending/15 text-pending">
            <BellRing className="size-3.5" />
          </span>
          {t("due.title")}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {formatAmount(total)}
        </CardTitle>
        <CardDescription>
          {t("due.count", { count: pledges.length })} · {t("due.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {pledges.map((p) => {
            const overdue = Boolean(p.due_on) && p.due_on! < today;
            return (
              <li key={p.id} className="rounded-lg border p-2.5">
                {/* Name and amount on their own line: with the two buttons on
                    the same row, a phone squeezed the name to one word per
                    line. Buttons sit below, full-width and thumb-sized. */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="wrap-anywhere min-w-0 text-sm font-medium">
                    {p.donor_name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatAmount(p.amount)}
                  </span>
                </div>

                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {p.due_on
                    ? overdue
                      ? t("status.overdue", {
                          date: formatDate(p.due_on, locale),
                        })
                      : t("due.today")
                    : ""}
                </p>

                <div className="mt-2 flex gap-2 sm:justify-end">
                  {/* A nudge to the contributor uses the same wa.me intent the
                      receipts do — no API, no keys, nothing to configure. */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() =>
                      window.open(
                        pledgeReminderUrl(p, mandalName),
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    <MessageCircle /> {t("due.remind")}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => setToMarkPaid(p)}
                    disabled={paying === p.id}
                  >
                    {paying === p.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    {t("status.markPaid")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <AlertDialog
        open={Boolean(toMarkPaid)}
        onOpenChange={(open) => {
          if (!open) setToMarkPaid(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("status.chooseMethod")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("status.chooseMethodBody", {
                name: toMarkPaid?.donor_name ?? "",
                amount: toMarkPaid ? formatAmount(toMarkPaid.amount) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paying === toMarkPaid?.id}>
              {t("form.cancel")}
            </AlertDialogCancel>
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m}
                disabled={paying === toMarkPaid?.id}
                onClick={async () => {
                  if (!toMarkPaid) return;
                  await markPaid(toMarkPaid, m);
                  setToMarkPaid(undefined);
                }}
              >
                {paying === toMarkPaid?.id ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t(`method.${m}`)}
              </Button>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
