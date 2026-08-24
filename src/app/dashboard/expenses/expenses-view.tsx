"use client";

import * as React from "react";
import { Check, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, markExpensePaid } from "@/app/actions/expenses";
import { useI18n } from "@/lib/i18n/client";
import {
  displayName,
  formatAmount,
  formatDate,
  isPartPaid,
  outstanding,
  received,
  todayInIst,
} from "@/lib/receipt-utils";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type Expense,
  type ExpenseCategory,
  type NameMap,
  type PaymentMethod,
} from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALL_TIME,
  CustomDateRange,
  filterByPeriod,
  PeriodPresets,
  type Period,
} from "../period-filter";
import { PaidPill, UnpaidBadge } from "../money-badges";
import { PaidProgress } from "../paid-progress";
import { ExpenseDialog } from "./expense-dialog";
import { SortFilter } from "../sort-filter";
import { DEFAULT_SORT, sortRows, type SortKey } from "../sort-rows";
import { CategoryBreakdown } from "./category-breakdown";
import { categoryTotals } from "./category-totals";

export function ExpensesView({
  expenses,
  names,
  truncated,
}: {
  expenses: Expense[];
  names: NameMap;
  /** Row cap that was hit, when the list is not the whole ledger. */
  truncated?: number;
}) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = React.useState<Period>(ALL_TIME);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>(DEFAULT_SORT);
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null);
  const [editing, setEditing] = React.useState<Expense | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Expense | undefined>();
  const [deleting, setDeleting] = React.useState(false);
  /** Bill waiting for the volunteer to say how it was actually paid. */
  const [toMarkPaid, setToMarkPaid] = React.useState<Expense | undefined>();
  /** Id of the bill currently being settled. */
  const [marking, setMarking] = React.useState<string | null>(null);

  // period-filter works on `collection_date`; expenses carry `spent_on`.
  const inPeriod = React.useMemo(
    () =>
      filterByPeriod(
        expenses.map((e) => ({ ...e, collection_date: e.spent_on })),
        period,
      ),
    [expenses, period],
  );

  // Built from the period alone, deliberately before the category filter: a
  // breakdown computed after it would collapse to the one row you selected.
  const breakdown = React.useMemo(() => categoryTotals(inPeriod), [inPeriod]);

  const visible = React.useMemo(() => {
    const clean = query.trim().toLowerCase();
    const inCategory = category
      ? inPeriod.filter((e) => e.category === category)
      : inPeriod;
    const matched = !clean
      ? inCategory
      : inCategory.filter(
          (e) =>
            e.description.toLowerCase().includes(clean) ||
            (e.note ?? "").toLowerCase().includes(clean) ||
            e.category.toLowerCase().includes(clean),
        );
    return sortRows(matched, sort, {
      date: (e) => e.spent_on,
      amount: (e) => e.amount,
      name: (e) => e.description,
    }, locale);
  }, [inPeriod, query, category, sort, locale]);

  // Money that actually left the box, and what is still owed on the same rows.
  // Summing `amount` here would report a committed bill as spent.
  const total = visible.reduce((sum, e) => sum + received(e), 0);
  const owed = visible.reduce((sum, e) => sum + outstanding(e), 0);

  /** Today on the mandal's calendar, for deciding what is overdue. */
  const today = todayInIst();

  const dueTitle = (dueOn: string | null) => {
    if (!dueOn) return t("expenses.unpaidBadge");
    const date = formatDate(dueOn, locale);
    return dueOn < today
      ? t("expenses.overdue", { date })
      : t("expenses.dueOnTitle", { date });
  };

  /** Settles a bill from the list; the method is asked for first. */
  async function markPaid(expense: Expense, method: PaymentMethod) {
    setMarking(expense.id);
    let result;
    try {
      result = await markExpensePaid(expense.id, method);
    } catch {
      setMarking(null);
      toast.error(t("error.body"));
      return;
    }
    setMarking(null);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("expenses.conflict"));
      return;
    }
    toast.success(t("expenses.markedPaid"));
  }

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    let result;
    try {
      result = await deleteExpense(toDelete.id);
    } catch {
      setDeleting(false);
      toast.error(t("error.body"));
      return;
    }
    setDeleting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("expenses.conflict"));
      return;
    }
    toast.success(t("expenses.deleted"));
    setToDelete(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* The action keeps the top-right corner beside the heading at every
            width, rather than moving between rows as the layout changes. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("expenses.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("expenses.total")}:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatAmount(total)}
              </span>{" "}
              · {t("expenses.count", { count: visible.length })}
              {/* Never added into the total beside it: one is money gone, the
                  other money still to go. */}
              {owed > 0 ? (
                <>
                  {" · "}
                  {t("expenses.owed")}:{" "}
                  <span className="font-medium tabular-nums text-pending-ink">
                    {formatAmount(owed)}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus /> {t("expenses.new")}
          </Button>
        </div>
        <PeriodPresets period={period} onChange={setPeriod} />
      </div>

      {truncated ? (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          {t("expenses.limit", { count: truncated })}
        </p>
      ) : null}

      <CategoryBreakdown
        rows={breakdown}
        selected={category}
        onSelect={setCategory}
      />

      <Card className="card-elevated">
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("expenses.search")}
                  className="pl-8"
                />
              </div>
              <SortFilter value={sort} onChange={setSort} />
            </div>
            <CustomDateRange period={period} onChange={setPeriod} />

            {/* Phones get the card list below; the table starts at sm. */}
            <div className="hidden max-h-[70vh] overflow-auto rounded-xl border sm:block">
              <Table className="table-zebra table-sticky">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("expenses.description")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.amount")}
                    </TableHead>
                    <TableHead>{t("expenses.category")}</TableHead>
                    <TableHead>{t("table.method")}</TableHead>
                    <TableHead>{t("expenses.date")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {expenses.length === 0
                          ? t("expenses.empty")
                          : t("expenses.emptyPeriod")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          <span className="wrap-anywhere">{e.description}</span>
                          {e.note ? (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {e.note}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              // Struck through only when none of it has been
                              // paid. A part-paid bill has real money against
                              // it, so striking the figure would misread it.
                              e.payment_status === "Unpaid" && !isPartPaid(e)
                                ? "text-muted-foreground line-through"
                                : undefined
                            }
                          >
                            {formatAmount(e.amount)}
                          </span>
                          {isPartPaid(e) ? (
                            <span className="mt-0.5 flex items-center justify-end gap-2">
                              <PaidProgress
                                paid={received(e)}
                                total={e.amount}
                                className="w-14"
                              />
                              <PaidPill
                                label={t("expenses.advancePaid", {
                                  paid: formatAmount(received(e)),
                                })}
                              />
                            </span>
                          ) : null}
                          {e.payment_status === "Unpaid" ? (
                            <span className="mt-0.5 block">
                              <UnpaidBadge
                                dueOn={e.due_on}
                                today={today}
                                label={
                                  isPartPaid(e)
                                    ? t("expenses.remainingBadge", {
                                        amount: formatAmount(outstanding(e)),
                                      })
                                    : t("expenses.unpaidBadge")
                                }
                                title={dueTitle(e.due_on)}
                              />
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(`category.${e.category}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>{t(`method.${e.payment_method}`)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(e.spent_on, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            onEdit={() => openEdit(e)}
                            onDelete={() => setToDelete(e)}
                            onMarkPaid={
                              e.payment_status === "Unpaid"
                                ? () => setToMarkPaid(e)
                                : undefined
                            }
                            markPaidLabel={t("expenses.markPaid")}
                            editLabel={t("table.edit")}
                            deleteLabel={t("table.delete")}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: one card per expense — the amount is the prominent thing. */}
            <ul className="flex flex-col gap-2 sm:hidden">
              {visible.length === 0 ? (
                <li className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                  {expenses.length === 0
                    ? t("expenses.empty")
                    : t("expenses.emptyPeriod")}
                </li>
              ) : (
                visible.map((e) => (
                  <li key={e.id} className="rounded-lg border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="wrap-anywhere min-w-0 text-sm font-medium">
                        {e.description}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {/* The same pair of pills the receipt card uses:
                            advance and remainder, equal weight, no total. */}
                        {isPartPaid(e) ? (
                          <>
                            <PaidPill
                              label={t("expenses.advancePaid", {
                                paid: formatAmount(received(e)),
                              })}
                            />
                            <UnpaidBadge
                              dueOn={e.due_on}
                              today={today}
                              label={t("expenses.remainingBadge", {
                                amount: formatAmount(outstanding(e)),
                              })}
                              title={dueTitle(e.due_on)}
                            />
                            <PaidProgress
                              paid={received(e)}
                              total={e.amount}
                              className="w-full"
                            />
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "font-bold tabular-nums",
                                // Nothing paid yet, so the figure is what was
                                // agreed rather than what has gone out.
                                e.payment_status === "Unpaid" &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {formatAmount(e.amount)}
                            </span>
                            {e.payment_status === "Unpaid" ? (
                              <UnpaidBadge
                                dueOn={e.due_on}
                                today={today}
                                label={t("expenses.unpaidBadge")}
                                title={dueTitle(e.due_on)}
                              />
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant="outline">
                        {t(`category.${e.category}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t(`method.${e.payment_method}`)} ·{" "}
                        {formatDate(e.spent_on, locale)}
                      </span>
                      <span className="ml-auto">
                        <RowActions
                          onEdit={() => openEdit(e)}
                          onDelete={() => setToDelete(e)}
                          onMarkPaid={
                            e.payment_status === "Unpaid"
                              ? () => setToMarkPaid(e)
                              : undefined
                          }
                          markPaidLabel={t("expenses.markPaid")}
                          editLabel={t("table.edit")}
                          deleteLabel={t("table.delete")}
                        />
                      </span>
                    </div>
                    {e.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.note}
                      </p>
                    ) : null}
                    {e.created_by_email ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {displayName(e.created_by_email, names)}
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        // Remounts the body so the fields reset between opens without an
        // effect writing state during render.
        key={editing?.id ?? "new"}
      >
        {dialogOpen ? (
          <ExpenseDialog expense={editing} onOpenChange={setDialogOpen} />
        ) : null}
      </Dialog>

      {/* How a bill was actually paid isn't known until the money goes out, so
          it is asked for rather than assumed from the row. */}
      <AlertDialog
        open={Boolean(toMarkPaid)}
        onOpenChange={(open) => !open && setToMarkPaid(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenses.chooseMethod")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toMarkPaid
                ? t("status.chooseMethodBody", {
                    name: toMarkPaid.description,
                    // The remainder, not the face amount: on a part-paid bill
                    // that is what is about to be handed over.
                    amount: formatAmount(outstanding(toMarkPaid)),
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={marking === toMarkPaid?.id}>
              {t("form.cancel")}
            </AlertDialogCancel>
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m}
                disabled={marking === toMarkPaid?.id}
                onClick={async () => {
                  if (!toMarkPaid) return;
                  await markPaid(toMarkPaid, m);
                  setToMarkPaid(undefined);
                }}
              >
                {t(`method.${m}`)}
              </Button>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenses.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? t("expenses.deleteBody", {
                    description: toDelete.description,
                    amount: formatAmount(toDelete.amount),
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {t("table.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  onMarkPaid,
  markPaidLabel,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** Present only for a bill that is not settled yet. */
  onMarkPaid?: () => void;
  markPaidLabel: string;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" variant="ghost" title={editLabel}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {onMarkPaid ? (
          <DropdownMenuItem onClick={onMarkPaid}>
            <Check /> {markPaidLabel}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
