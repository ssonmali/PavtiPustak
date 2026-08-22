"use client";

import * as React from "react";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createReceipt, updateReceipt } from "@/app/actions/receipts";
import { PAYMENT_METHODS, type Receipt } from "@/lib/types";
import { formatDate, toDateValue } from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  receipt?: Receipt;
};

/** Parses a stored `YYYY-MM-DD` without the UTC shift `new Date(str)` causes. */
function parseDateValue(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function ReceiptDialog({ open, onOpenChange, receipt }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Remounting on the target row resets the form without an effect. */}
      <ReceiptDialogBody
        key={receipt?.id ?? "new"}
        onOpenChange={onOpenChange}
        receipt={receipt}
      />
    </Dialog>
  );
}

function ReceiptDialogBody({
  onOpenChange,
  receipt,
}: Omit<Props, "open">) {
  const { t } = useI18n();
  const isEdit = Boolean(receipt);
  const [pending, setPending] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(() =>
    receipt ? parseDateValue(receipt.collection_date) : new Date(),
  );
  const [method, setMethod] = React.useState<string>(
    receipt?.payment_method ?? "Cash",
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    const result = receipt
      ? await updateReceipt(receipt.id, formData)
      : await createReceipt(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? t("toast.updated") : t("toast.saved"));
    onOpenChange(false);
  }

  return (
    <DialogContent className="sm:max-w-md">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="donor_name">{t("form.donorName")}</Label>
          <Input
            id="donor_name"
            name="donor_name"
            defaultValue={receipt?.donor_name ?? ""}
            placeholder={t("form.donorPlaceholder")}
            autoComplete="off"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
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
                    {date ? formatDate(toDateValue(date)) : t("form.pickDate")}
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

        <DialogFooter className="mt-2">
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
  );
}
