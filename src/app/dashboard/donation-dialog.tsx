"use client";

import * as React from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createDonation, updateDonation } from "@/app/actions/donations";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, toDateValue } from "@/lib/receipt-utils";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Parses `YYYY-MM-DD` on the local calendar; `new Date(iso)` shifts in IST. */
function fromDateValue(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DonationDialog({
  donation,
  onOpenChange,
}: {
  /** The row being edited, or undefined when logging a new donation. */
  donation?: Donation;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const isEdit = Boolean(donation);

  const [pending, setPending] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    donation ? fromDateValue(donation.donation_date) : new Date(),
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    let result;
    try {
      result = donation
        ? await updateDonation(donation.id, formData)
        : await createDonation(formData);
    } catch {
      setPending(false);
      toast.error(t("error.body"));
      return;
    }
    setPending(false);

    if (result.ok) {
      toast.success(t("donation.saved"));
      onOpenChange(false);
      return;
    }
    if ("conflict" in result) {
      toast.error(t("donation.conflict"));
      onOpenChange(false);
      return;
    }
    toast.error(result.error);
  }

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t("donation.edit") : t("donation.new")}
        </DialogTitle>
        <DialogDescription>{t("donation.subtitle")}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* Optimistic locking token: whoever saves second is told, not ignored. */}
        {donation ? (
          <input
            type="hidden"
            name="expected_updated_at"
            value={donation.updated_at}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="donor_name">{t("table.donor")}</Label>
          <Input
            id="donor_name"
            name="donor_name"
            defaultValue={donation?.donor_name ?? ""}
            autoComplete="off"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone_number">{t("donation.mobileOptional")}</Label>
          <Input
            id="phone_number"
            name="phone_number"
            type="tel"
            inputMode="numeric"
            defaultValue={donation?.phone_number ?? ""}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="item">{t("donation.item")}</Label>
          <Input
            id="item"
            name="item"
            defaultValue={donation?.item ?? ""}
            placeholder={t("donation.itemPlaceholder")}
            autoComplete="off"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="value">{t("donation.value")}</Label>
            <Input
              id="value"
              name="value"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              defaultValue={
                donation?.value != null ? String(Number(donation.value)) : ""
              }
              placeholder={t("donation.valuePlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("donation.date")}</Label>
            <input
              type="hidden"
              name="donation_date"
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
          >
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {t("donation.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
