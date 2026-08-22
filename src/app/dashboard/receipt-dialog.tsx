"use client";

import * as React from "react";
import { CalendarIcon, Loader2, Save, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";
import {
  createReceipt,
  searchDonors,
  updateReceipt,
} from "@/app/actions/receipts";
import { PAYMENT_METHODS, type Donor, type PaymentMethod } from "@/lib/types";
import type { LocalReceipt, OutboxEntry } from "@/lib/offline";
import { formatAmount, formatDate, toDateValue } from "@/lib/receipt-utils";
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

type QueueFn = (
  entry: Omit<OutboxEntry, "localId" | "queuedAt" | "attempts">,
) => Promise<void>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  online = true,
  queue,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Remounting on the target row resets the form without an effect. */}
      <ReceiptDialogBody
        key={receipt?.id ?? "new"}
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

  // Donor autocomplete
  const [donorQuery, setDonorQuery] = React.useState(receipt?.donor_name ?? "");
  const [matches, setMatches] = React.useState<Donor[]>([]);
  const [showMatches, setShowMatches] = React.useState(false);
  const phoneRef = React.useRef<HTMLInputElement>(null);

  // Duplicate confirmation
  const [dup, setDup] = React.useState<{
    amount: number;
    date: string;
    who: string | null;
    formData: FormData;
  } | null>(null);

  /** Looks up past donors as the volunteer types, debounced. */
  function onDonorInput(value: string) {
    setDonorQuery(value);
    if (isEdit) return;
    setShowMatches(true);
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
  }

  /** Reads the form into the shape the outbox stores. */
  function fieldsFrom(formData: FormData) {
    return {
      donor_name: String(formData.get("donor_name") ?? "").trim(),
      amount: Number(formData.get("amount") ?? 0),
      phone_number: String(formData.get("phone_number") ?? "")
        .replace(/[\s-]/g, "")
        .replace(/^(\+91|91|0)/, ""),
      payment_method: String(formData.get("payment_method") ?? "Cash") as PaymentMethod,
      collection_date: String(formData.get("collection_date") ?? ""),
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t("form.method")}</Label>
              {/* Base UI Select is controlled; mirror it into a hidden input. */}
              <input type="hidden" name="payment_method" value={method} />
              <Select value={method} onValueChange={(v) => setMethod(String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
