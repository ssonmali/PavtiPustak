"use client";

import * as React from "react";
import { CalendarIcon, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { createDonation, updateDonation } from "@/app/actions/donations";
import { searchDonors } from "@/app/actions/receipts";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, toDateValue } from "@/lib/receipt-utils";
import type { Donation, Donor } from "@/lib/types";
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

  // Donor autocomplete — the same donor_directory receipts use, since a past
  // contributor is often the one dropping off an item too.
  const [donorQuery, setDonorQuery] = React.useState(donation?.donor_name ?? "");
  const [matches, setMatches] = React.useState<Donor[]>([]);
  const [showMatches, setShowMatches] = React.useState(false);
  const phoneRef = React.useRef<HTMLInputElement>(null);

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

  const suggestions =
    !isEdit && donorQuery.trim().length >= 2 && showMatches ? matches : [];

  function pickDonor(donor: Donor) {
    setDonorQuery(donor.donor_name);
    setShowMatches(false);
    if (phoneRef.current) phoneRef.current.value = donor.phone_number;
  }

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

        <div className="relative flex flex-col gap-2">
          <Label htmlFor="donor_name">{t("donation.donor")}</Label>
          <Input
            id="donor_name"
            name="donor_name"
            value={donorQuery}
            onChange={(e) => onDonorInput(e.target.value)}
            onBlur={() => setTimeout(() => setShowMatches(false), 150)}
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone_number">{t("donation.mobileOptional")}</Label>
          <Input
            ref={phoneRef}
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
