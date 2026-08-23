"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense } from "@/app/actions/expenses";
import { useI18n } from "@/lib/i18n/client";
import {
  displayName,
  formatAmount,
  formatDate,
} from "@/lib/receipt-utils";
import type { Expense, ExpenseCategory, NameMap } from "@/lib/types";
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
  filterByPeriod,
  PeriodFilter,
  type Period,
} from "../period-filter";
import { ExpenseDialog } from "./expense-dialog";
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
  const [period, setPeriod] = React.useState<Period>(0);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null);
  const [editing, setEditing] = React.useState<Expense | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Expense | undefined>();
  const [deleting, setDeleting] = React.useState(false);

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
    if (!clean) return inCategory;
    return inCategory.filter(
      (e) =>
        e.description.toLowerCase().includes(clean) ||
        (e.note ?? "").toLowerCase().includes(clean) ||
        e.category.toLowerCase().includes(clean),
    );
  }, [inPeriod, query, category]);

  const total = visible.reduce((sum, e) => sum + Number(e.amount), 0);

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
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus /> {t("expenses.new")}
          </Button>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
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
            <div className="relative sm:max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("expenses.search")}
                className="pl-8"
              />
            </div>

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
                          {formatAmount(e.amount)}
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
                      <span className="shrink-0 font-bold tabular-nums">
                        {formatAmount(e.amount)}
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
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
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
