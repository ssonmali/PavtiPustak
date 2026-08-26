"use client";

import * as React from "react";
import { CalendarIcon, Loader2, Save, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";
import {
  createReceipt,
  searchDonors,
  updateReceipt,
} from "@/app/actions/receipts";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type Donor,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/types";
import type { LocalReceipt, OutboxEntry } from "@/lib/offline";
import {
  capitalizeName,
  formatAmount,
  formatDate,
  toDateValue,
} from "@/lib/receipt-utils";
import { toDevanagariName } from "@/lib/devanagari-name";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type QueueFn = (
  entry: Omit<OutboxEntry, "localId" | "queuedAt" | "attempts">,
) => Promise<void>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bumped per blank form, so consecutive creates do not share their state. */
  instance?: number;
  /** Present when editing; absent when creating. */
  receipt?: LocalReceipt;
  online?: boolean;
  /** Present when writes should be queued instead of sent. */
  queue?: QueueFn;
};

/** Parses a stored `YYYY-MM-DD` without the UTC shift `new Date(str)` causes. */
function parseDateValue(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function ReceiptDialog({
  open,
  onOpenChange,
  receipt,
  instance,
  online = true,
  queue,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Remounting on the target row resets the form without an effect. The
          body outlives the closed dialog, so a second new receipt would keep
          the first one's donor: every blank form needs its own identity, which
          is what `instance` supplies. */}
      <ReceiptDialogBody
        key={receipt?.id ?? `new:${instance ?? 0}`}
        onOpenChange={onOpenChange}
        receipt={receipt}
        online={online}
        queue={queue}
      />
    </Dialog>
  );
}

function ReceiptDialogBody({
  onOpenChange,
  receipt,
  online = true,
  queue,
}: Omit<Props, "open">) {
  const { t, locale } = useI18n();
  const isEdit = Boolean(receipt);
  const [pending, setPending] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(() =>
    receipt ? parseDateValue(receipt.collection_date) : new Date(),
  );
  const [method, setMethod] = React.useState<string>(
    receipt?.payment_method ?? "Cash",
  );
  const [status, setStatus] = React.useState<string>(
    receipt?.payment_status ?? "Paid",
  );
  /**
   * How far back the due-date picker may go.
   *
   * Normally today — a promise is about the future. But an overdue pledge has a
   * due date already in the past, and locking the picker at today would leave
   * its own selected day unpickable: re-dating it would mean jumping forward
   * first. So the floor drops to whichever is earlier.
   */
  const earliestDue = (() => {
    const today = new Date();
    const existing = receipt?.due_on
      ? parseDateValue(receipt.due_on)
      : undefined;
    return existing && existing < today ? existing : today;
  })();

  // Defaults a week out: a pledge with no plausible date is one nobody chases.
  const [dueDate, setDueDate] = React.useState<Date | undefined>(() => {
    if (receipt?.due_on) return parseDateValue(receipt.due_on);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });

  // Donor autocomplete
  const [donorQuery, setDonorQuery] = React.useState(receipt?.donor_name ?? "");
  const [matches, setMatches] = React.useState<Donor[]>([]);
  const [showMatches, setShowMatches] = React.useState(false);
  const phoneRef = React.useRef<HTMLInputElement>(null);

  /**
   * The Marathi spelling that goes on the receipt image.
   *
   * It tracks the English name as it is typed, until the volunteer edits it —
   * from then on it is theirs and this stops overwriting it, because a guess
   * silently replacing a correction is the one behaviour that would make the
   * field pointless. Clearing it hands control back.
   */
  const [nameMr, setNameMr] = React.useState(receipt?.donor_name_mr ?? "");
  const [nameMrEdited, setNameMrEdited] = React.useState(
    Boolean(receipt?.donor_name_mr),
  );

  // Duplicate confirmation
  const [dup, setDup] = React.useState<{
    amount: number;
    date: string;
    who: string | null;
    formData: FormData;
  } | null>(null);

  /** Looks up past donors as the volunteer types, debounced. */
  function onDonorInput(raw: string) {
    // A donor's name always reads as a name on the receipt, so the first letter
    // of each word is capitalised as it is typed rather than left to the
    // volunteer's shift key.
    const value = capitalizeName(raw);
    setDonorQuery(value);
    // Keep the Marathi suggestion in step with the English name, unless it has
    // been corrected by hand.
    if (!nameMrEdited) setNameMr(toDevanagariName(value));
    if (isEdit) return;
    setShowMatches(true);
  }

  function onNameMrInput(value: string) {
    setNameMr(value);
    // Blank means "go back to suggesting"; anything else is the volunteer's.
    setNameMrEdited(value.trim().length > 0);
  }

  React.useEffect(() => {
    if (isEdit || donorQuery.trim().length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchDonors(donorQuery);
      if (!cancelled) setMatches(found);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [donorQuery, isEdit]);

  // Derived, so a too-short query hides stale results without a setState.
  const suggestions =
    !isEdit && donorQuery.trim().length >= 2 && showMatches ? matches : [];

  function pickDonor(donor: Donor) {
    setDonorQuery(donor.donor_name);
    setShowMatches(false);
    // Auto-fill the number we already have for this donor.
    if (phoneRef.current) phoneRef.current.value = donor.phone_number;
    // A spelling corrected on an earlier receipt is reused rather than
    // re-guessed — that is the whole point of storing it.
    if (donor.donor_name_mr) {
      setNameMr(donor.donor_name_mr);
      setNameMrEdited(true);
    } else {
      setNameMr(toDevanagariName(donor.donor_name));
      setNameMrEdited(false);
    }
  }

  /** Reads the form into the shape the outbox stores. */
  function fieldsFrom(formData: FormData) {
    return {
      donor_name: String(formData.get("donor_name") ?? "").trim(),
      donor_name_mr:
        String(formData.get("donor_name_mr") ?? "").trim() || null,
      amount: Number(formData.get("amount") ?? 0),
      // Null for a settled receipt, matching what the schema stores.
      paid_amount:
        String(formData.get("payment_status") ?? "Paid") === "Unpaid"
          ? Number(formData.get("paid_amount") ?? 0) || null
          : null,
      phone_number: String(formData.get("phone_number") ?? "")
        .replace(/[\s-]/g, "")
        .replace(/^(\+91|91|0)/, ""),
      payment_method: String(formData.get("payment_method") ?? "Cash") as PaymentMethod,
      collection_date: String(formData.get("collection_date") ?? ""),
      payment_status: String(
        formData.get("payment_status") ?? "Paid",
      ) as PaymentStatus,
      // Kept null for a paid row, matching the DB constraint.
      due_on:
        String(formData.get("payment_status") ?? "Paid") === "Unpaid"
          ? String(formData.get("due_on") ?? "") || null
          : null,
    };
  }

  /** Stores the write on the device for the outbox to replay later. */
  async function queueLocally(formData: FormData) {
    if (!queue) return false;
    try {
      await queue(
        receipt && receipt.pending !== "create"
          ? {
              kind: "update",
              receiptId: receipt.id,
              fields: fieldsFrom(formData),
              expectedUpdatedAt: receipt.updated_at,
            }
          : { kind: "create", fields: fieldsFrom(formData) },
      );
      toast.success(t("offline.queued"));
      onOpenChange(false);
      return true;
    } catch {
      toast.error(t("offline.storageBlocked"));
      return true; // handled: an error was shown
    }
  }

  async function submit(formData: FormData) {
    // Known offline: do not even attempt the request.
    if (!online && (await queueLocally(formData))) return;

    setPending(true);
    let result;
    try {
      result = receipt
        ? await updateReceipt(receipt.id, formData)
        : await createReceipt(formData);
    } catch {
      // navigator.onLine lies — a captive portal or a dropped connection looks
      // online right up until the request fails. Falling back here is what
      // makes saving reliable, rather than the flag being correct.
      setPending(false);
      if (await queueLocally(formData)) return;
      toast.error(t("error.body"));
      return;
    }
    setPending(false);

    if (result.ok) {
      toast.success(isEdit ? t("toast.updated") : t("toast.saved"));
      onOpenChange(false);
      return;
    }
    if ("duplicate" in result) {
      setDup({ ...result.duplicate, formData });
      return;
    }
    if ("conflict" in result) {
      toast.error(t("toast.conflict"));
      onOpenChange(false);
      return;
    }
    toast.error(result.error);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(new FormData(event.currentTarget));
  }

  async function saveAnyway() {
    if (!dup) return;
    const formData = dup.formData;
    formData.set("confirm_duplicate", "1");
    setDup(null);
    await submit(formData);
  }

  return (
    <>
      <DialogContent className="max-h-visual overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.newTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("form.editSubtitle", { number: receipt?.receipt_number ?? "" })
              : t("form.newSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Optimistic locking token: whoever saves second is told, not ignored. */}
          {receipt ? (
            <input
              type="hidden"
              name="expected_updated_at"
              value={receipt.updated_at}
            />
          ) : null}

          <div className="relative flex flex-col gap-2">
            <Label htmlFor="donor_name">{t("form.donorName")}</Label>
            <Input
              id="donor_name"
              name="donor_name"
              value={donorQuery}
              onChange={(e) => onDonorInput(e.target.value)}
              onBlur={() => setTimeout(() => setShowMatches(false), 150)}
              placeholder={t("form.donorPlaceholder")}
              autoComplete="off"
              required
            />

            {suggestions.length > 0 ? (
              <ul className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
                {suggestions.map((donor) => (
                  <li key={`${donor.donor_name}-${donor.phone_number}`}>
                    <button
                      type="button"
                      className="flex w-full min-h-11 flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickDonor(donor)}
                    >
                      <span className="flex w-full items-center gap-1.5 text-sm">
                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="wrap-anywhere min-w-0 flex-1">
                          {donor.donor_name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {donor.phone_number}
                        </span>
                      </span>
                      <span className="pl-5 text-xs text-muted-foreground">
                        {t("form.donorHint", {
                          count: donor.receipt_count,
                          date: formatDate(donor.last_collection, locale),
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* The name as it will appear on the receipt the donor receives.
              Suggested from the English spelling and editable, because English
              cannot express ट vs त or ळ vs ल — "Patil" is पाटील, and nothing
              in the letters says so. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="donor_name_mr">{t("form.donorNameMr")}</Label>
            <Input
              id="donor_name_mr"
              name="donor_name_mr"
              value={nameMr}
              onChange={(e) => onNameMrInput(e.target.value)}
              placeholder={t("form.donorNameMrPlaceholder")}
              autoComplete="off"
              lang="mr"
            />
            <p className="text-xs text-muted-foreground">
              {t("form.donorNameMrHint")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">{t("form.amount")}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                defaultValue={receipt ? String(Number(receipt.amount)) : ""}
                placeholder="501"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone_number">{t("form.mobile")}</Label>
              <Input
                ref={phoneRef}
                id="phone_number"
                name="phone_number"
                type="tel"
                inputMode="numeric"
                defaultValue={receipt?.phone_number ?? ""}
                placeholder="9876543210"
                required
              />
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-3",
              status === "Paid" && "sm:grid-cols-2",
            )}
          >
            {/* How it was received isn't known until it is — a pledge has no
                method yet, so asking now would just record a guess. */}
            {status === "Paid" ? (
              <div className="flex flex-col gap-2">
                <Label>{t("form.method")}</Label>
                {/* Base UI Select is controlled; mirror it into a hidden input. */}
                <input type="hidden" name="payment_method" value={method} />
                <Select value={method} onValueChange={(v) => setMethod(String(v))}>
                  <SelectTrigger className="w-full">
                    {/* Without a formatter Base UI puts the raw value here, so
                        the trigger read "Cash" while the list read "रोख". */}
                    <SelectValue>
                      {(v) => t(v === "UPI" ? "method.UPI" : "method.Cash")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`method.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Still submitted so the not-null column is satisfied; meaningless
              // until the pledge is marked received, when this field reappears.
              <input type="hidden" name="payment_method" value={method} />
            )}

            <div className="flex flex-col gap-2">
              <Label>{t("form.date")}</Label>
              <input
                type="hidden"
                name="collection_date"
                value={date ? toDateValue(date) : ""}
              />
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      <CalendarIcon />
                      {date
                        ? formatDate(toDateValue(date), locale)
                        : t("form.pickDate")}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    defaultMonth={date}
                    captionLayout="dropdown"
                    // Backdating is the point; only the future is off-limits.
                    disabled={{ after: new Date() }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Received or promised. A pledge is recorded so it can be chased,
              and is kept out of every collected figure until it is marked paid. */}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label>{t("form.status")}</Label>
            <input type="hidden" name="payment_status" value={status} />
            <div className="flex gap-1 rounded-lg border p-0.5">
              {PAYMENT_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? "secondary" : "ghost"}
                  className="flex-1"
                  onClick={() => setStatus(s)}
                >
                  {t(`status.${s}`)}
                </Button>
              ))}
            </div>

            {status === "Unpaid" ? (
              <div className="flex flex-col gap-2">
                {/* Paid in instalments: how much has arrived so far. Left
                    blank means none of it has. The receipt cannot be sent
                    until this reaches the full amount. */}
                <Label htmlFor="paid_amount">{t("form.paidSoFar")}</Label>
                <Input
                  id="paid_amount"
                  name="paid_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={
                    receipt?.paid_amount != null
                      ? String(Number(receipt.paid_amount))
                      : ""
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.paidSoFarHint")}
                </p>

                <Label>{t("form.dueOn")}</Label>
                <input
                  type="hidden"
                  name="due_on"
                  value={dueDate ? toDateValue(dueDate) : ""}
                />
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start font-normal"
                      >
                        <CalendarIcon />
                        {dueDate
                          ? formatDate(toDateValue(dueDate), locale)
                          : t("form.pickDate")}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      defaultMonth={dueDate}
                      captionLayout="dropdown"
                      // The opposite of the collection date: a promise is about
                      // the future, so the past is off-limits — except back to
                      // an existing overdue date. See earliestDue.
                      disabled={{ before: earliestDue }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  {t("form.dueHint")}
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? t("form.saveChanges") : t("form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Advisory only — a donor may genuinely give twice on the same day. */}
      <AlertDialog
        open={Boolean(dup)}
        onOpenChange={(o) => {
          if (!o) setDup(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-amber-600" />
              {t("dup.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dup
                ? t("dup.body", {
                    amount: formatAmount(dup.amount),
                    date: formatDate(dup.date, locale),
                    by: dup.who ? t("dup.by", { who: dup.who }) : "",
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={saveAnyway} disabled={pending}>
              {t("dup.saveAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
