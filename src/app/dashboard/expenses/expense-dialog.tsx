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
  PAYMENT_STATUSES,
  type Expense,
  type ExpenseCategory,
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

/** The typed dictionary takes literal keys, so the label is looked up. */
const CATEGORY_KEYS = {
  Decoration: "category.Decoration",
  Prasad: "category.Prasad",
  Food: "category.Food",
  Sound: "category.Sound",
  Idol: "category.Idol",
  Mandap: "category.Mandap",
  Electricity: "category.Electricity",
  Other: "category.Other",
} as const;

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
  const [status, setStatus] = React.useState<string>(
    expense?.payment_status ?? "Paid",
  );

  /**
   * How far back the due-date picker may go. Normally today — a bill still to
   * be paid is about the future. But an overdue bill's own date is already in
   * the past, and locking the floor at today would leave it unpickable.
   */
  const earliestDue = (() => {
    const today = new Date();
    const existing = expense?.due_on ? fromDateValue(expense.due_on) : undefined;
    return existing && existing < today ? existing : today;
  })();

  // Defaults a week out: a bill with no plausible date is one nobody chases.
  const [dueDate, setDueDate] = React.useState<Date | undefined>(() => {
    if (expense?.due_on) return fromDateValue(expense.due_on);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });

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
    <DialogContent className="max-h-visual overflow-y-auto sm:max-w-md">
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
                {/* Without a formatter Base UI shows the raw value, so the
                    trigger stayed English while the list was translated. */}
                <SelectValue>
                  {(v) => t(CATEGORY_KEYS[v as ExpenseCategory])}
                </SelectValue>
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

        {/* Paid, or committed. An unpaid bill is recorded so it can be
            chased, and is kept out of every spent figure until the money
            actually goes out. */}
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <Label>{t("expenses.status")}</Label>
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
                {t(s === "Paid" ? "expenses.statusPaid" : "expenses.statusUnpaid")}
              </Button>
            ))}
          </div>

          {status === "Unpaid" ? (
            <div className="flex flex-col gap-2">
              {/* Settled in instalments: how much has gone out so far. Blank
                  means none of it has. */}
              <Label htmlFor="paid_amount">{t("expenses.advance")}</Label>
              <Input
                id="paid_amount"
                name="paid_amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  expense?.paid_amount != null
                    ? String(Number(expense.paid_amount))
                    : ""
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t("expenses.advanceHint")}
              </p>

              <Label>{t("expenses.dueOn")}</Label>
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
                    // The opposite of the spend date: a bill still to be paid
                    // is about the future, so the past is off-limits — except
                    // back to an existing overdue date. See earliestDue.
                    disabled={{ before: earliestDue }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
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
