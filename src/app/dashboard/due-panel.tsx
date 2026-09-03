"use client";

import * as React from "react";
import {
  BellRing,
  Check,
  ChevronDown,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { markReceiptPaid } from "@/app/actions/receipts";
import { useI18n } from "@/lib/i18n/client";
import {
  formatAmount,
  formatDate,
  isPartPaid,
  outstanding,
  pledgeReminderUrl,
  received,
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
import { DUE_PAGE, duePanelView } from "./due-view";
import { PaidPill } from "./money-badges";
import { PaidProgress } from "./paid-progress";

/**
 * The reminder. Pledges due today or already overdue, at the top of the
 * dashboard — the volunteer is told when they open the app, which is the whole
 * mechanism, so it renders nothing when there is nothing to chase rather than
 * sitting there as a permanent empty box.
 *
 * The list itself starts collapsed: on a mandal with a dozen live pledges this
 * card pushed the whole dashboard below the fold. What is never collapsed is
 * the fact that money is owed — the header keeps the outstanding total and the
 * count, and the trigger carries an overdue badge that pulses, so the card asks
 * to be opened rather than waiting to be discovered.
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
  const [open, setOpen] = React.useState(false);
  const [shown, setShown] = React.useState(DUE_PAGE);

  if (pledges.length === 0) return null;

  const today = todayInIst();
  // What is still owed across the panel, not what was originally promised.
  const total = pledges.reduce((sum, p) => sum + outstanding(p), 0);
  const { visible, nextBatch, nextShown, overdueCount } = duePanelView(
    pledges,
    shown,
    today,
  );

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
          {/* The hint that makes a closed card ask to be opened.
              animate-pulse is an enhancement, not the message: globals.css
              zeroes every animation under prefers-reduced-motion, so anyone
              with Reduce Motion on would see nothing at all if the urgency
              lived in the movement. The badge itself carries it — same
              border/tint/ink idiom as the overdue badge in money-badges, which
              reads correctly in both themes — and the pulse only draws the eye.

              It stops once the card is open: past that point the volunteer is
              looking at the list, and a badge still blinking at them while
              they work down it is nagging, not informing. */}
          {overdueCount > 0 ? (
            <span
              className={cn(
                "rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-destructive tabular-nums",
                !open && "animate-pulse",
              )}
            >
              {t("due.overdueCount", { count: overdueCount })}
            </span>
          ) : null}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {formatAmount(total)}
        </CardTitle>
        <CardDescription>
          {t("due.count", { count: pledges.length })} · {t("due.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* The trigger sits above the list so its position does not move as
            rows are revealed — a button that walks down the screen under the
            thumb is how you tap the wrong thing. */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            // Reopening starts at the first page again: the list is ordered
            // most-overdue-first, so the top is always where to resume.
            if (open) setShown(DUE_PAGE);
            setOpen(!open);
          }}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("transition-transform", open && "rotate-180")}
          />
          {open ? t("due.hide") : t("due.show")}
        </Button>

        {!open ? null : (
          <ul className="mt-2 flex flex-col gap-2">
            {visible.map((p) => {
              const overdue = Boolean(p.due_on) && p.due_on! < today;
              return (
                <li key={p.id} className="glass-inset card-elevated rounded-lg border p-2.5">
                  {/* Name and amount on their own line: with the two buttons on
                    the same row, a phone squeezed the name to one word per
                    line. Buttons sit below, full-width and thumb-sized. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="wrap-anywhere min-w-0 text-sm font-medium">
                      {p.donor_name}
                    </span>
                    {/* What is still owed, not what was promised: the card total
                      above is the sum of these, and showing the face amount
                      here made the rows disagree with it on a part-paid
                      pledge. */}
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums text-pending-ink">
                        {formatAmount(outstanding(p))}
                      </span>
                      {isPartPaid(p) ? (
                        <span className="flex items-center gap-1.5">
                          <PaidProgress
                            paid={received(p)}
                            total={p.amount}
                            className="w-12"
                          />
                          <PaidPill
                            label={t("status.paidOfTotal", {
                              paid: formatAmount(received(p)),
                            })}
                          />
                        </span>
                      ) : null}
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
                      receipts do — no API, no keys, nothing to configure.
                      Touch targets are handled globally: @media (pointer: coarse)
                      in globals.css puts a 44px floor under every button on a
                      phone, so the size here is the DESKTOP density and must
                      not be inflated to compensate. */}
                    <Button
                      variant="outline"
                      size="sm"
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
            {nextBatch > 0 ? (
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShown(nextShown)}
                >
                  {t("due.viewMore", { count: nextBatch })}
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={Boolean(toMarkPaid)}
        onOpenChange={(next) => {
          if (!next) setToMarkPaid(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("status.chooseMethod")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("status.chooseMethodBody", {
                name: toMarkPaid?.donor_name ?? "",
                // The remainder, which is what is being handed over now.
                amount: toMarkPaid ? formatAmount(outstanding(toMarkPaid)) : "",
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
