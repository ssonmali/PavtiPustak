"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar-lazy";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, toDateValue } from "@/lib/receipt-utils";

/**
 * A labelled date picker that posts its value with the form.
 *
 * This was copy-pasted five times across the three entry dialogs — identical
 * down to the comment on the future-date guard — so a change to how dates are
 * picked meant finding every copy and getting all of them right.
 *
 * The hidden input is the point of the wrapper rather than an implementation
 * detail: the Calendar is controlled React state, which a native form submit
 * cannot see, so the value has to be mirrored into something FormData reads.
 */
export function DateField({
  name,
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  /** The FormData key this field posts under. */
  name: string;
  /** Already localised — the caller holds the dictionary key. */
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  /**
   * Which days cannot be chosen. `{ after: new Date() }` for a date that has
   * already happened, `{ before: floor }` for one still to come.
   */
  disabled?: Matcher;
  className?: string;
}) {
  const { t, locale } = useI18n();

  return (
    <div className={className ?? "flex flex-col gap-2"}>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value ? toDateValue(value) : ""} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
            >
              <CalendarIcon />
              {value ? formatDate(toDateValue(value), locale) : t("form.pickDate")}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            defaultMonth={value}
            captionLayout="dropdown"
            disabled={disabled}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
