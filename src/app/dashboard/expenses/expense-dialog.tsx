"use client";

import * as React from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/app/actions/expenses";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, toDateValue } from "@/lib/receipt-utils";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type Expense,
} from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Parses `YYYY-MM-DD` on the local calendar; `new Date(iso)` shifts in IST. */
function fromDateValue(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function ExpenseDialog({
  expense,
  onOpenChange,
}: {
  /** The row being edited, or undefined when recording a new expense. */
  expense?: Expense;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const isEdit = Boolean(expense);

  const [pending, setPending] = React.useState(false);
  const [category, setCategory] = React.useState<string>(
    expense?.category ?? "Other",
  );
  const [method, setMethod] = React.useState<string>(
    expense?.payment_method ?? "Cash",
  );
  const [date, setDate] = React.useState<Date | undefined>(
    expense ? fromDateValue(expense.spent_on) : new Date(),
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    let result;
    try {
      result = expense
        ? await updateExpense(expense.id, formData)
        : await createExpense(formData);
    } catch {
      setPending(false);
      toast.error(t("error.body"));
      return;
    }
    setPending(false);

    if (result.ok) {
      toast.success(t("expenses.saved"));
      onOpenChange(false);
      return;
    }
    if ("conflict" in result) {
      toast.error(t("expenses.conflict"));
      onOpenChange(false);
      return;
    }
    toast.error(result.error);
  }

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t("expenses.edit") : t("expenses.new")}
        </DialogTitle>
        <DialogDescription>{t("expenses.subtitle")}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* Optimistic locking token: whoever saves second is told, not ignored. */}
        {expense ? (
          <input
            type="hidden"
            name="expected_updated_at"
            value={expense.updated_at}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t("expenses.description")}</Label>
          <Input
            id="description"
            name="description"
            defaultValue={expense?.description ?? ""}
            placeholder={t("expenses.descriptionPlaceholder")}
            autoComplete="off"
            required
          />
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
              defaultValue={expense ? String(Number(expense.amount)) : ""}
              placeholder="2500"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("expenses.category")}</Label>
            {/* Base UI Select is controlled; mirror it into a hidden input. */}
            <input type="hidden" name="category" value={category} />
            <Select
              value={category}
              onValueChange={(v) => setCategory(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t("form.method")}</Label>
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
            <Label>{t("expenses.date")}</Label>
            <input
              type="hidden"
              name="spent_on"
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="note">{t("expenses.note")}</Label>
          <Input
            id="note"
            name="note"
            defaultValue={expense?.note ?? ""}
            placeholder={t("expenses.notePlaceholder")}
            autoComplete="off"
          />
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
            {t("expenses.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
