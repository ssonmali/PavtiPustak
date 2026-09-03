"use client";

import * as React from "react";
import { Check, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { useNewRows } from "@/lib/use-new-rows";
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
  isPeriodFiltered,
  periodLabelKey,
  PeriodPresets,
  type Period,
} from "../period-filter";
import { FilterSection, FilterSheet } from "@/components/filter-sheet";
import { PaidPill, UnpaidBadge } from "../money-badges";
import { PaidProgress } from "../paid-progress";
import { ExpenseDialog } from "./expense-dialog";
import { SortFilter } from "../sort-filter";
import {
  DEFAULT_SORT,
  SORT_KEYS,
  sortRows,
  type SortKey,
} from "../sort-rows";
import { CategoryBreakdown } from "./category-breakdown";
import { categoryTotals } from "./category-totals";

/** Everything but the receipt-number orders, which an expense cannot answer. */
const EXPENSE_SORT_KEYS = SORT_KEYS.filter((k) => !k.startsWith("number-"));

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
  /**
   * The term the LIST filters on, one step behind what is being typed.
   *
   * Expenses are filtered here rather than by the server, so every keystroke
   * re-ran the filter and the sort over as many as a thousand rows and then
   * re-rendered the list — which renders each expense twice, as a table row
   * and as a card, with CSS hiding the half you are not looking at. That work
   * happened between the key going down and the letter appearing, which is
   * what made typing feel heavy.
   *
   * useDeferredValue rather than a debounce, because the two fail differently:
   * a debounce makes the list wait a fixed time whether or not the phone is
   * busy, while this keeps the input at the highest priority and lets React
   * abandon a half-finished list render when the next letter arrives. On a
   * fast phone the list still keeps up keystroke for keystroke; on a slow one
   * it falls behind by a render instead of blocking the field.
   */
  const deferredQuery = React.useDeferredValue(query);
  const [sort, setSort] = React.useState<SortKey>(DEFAULT_SORT);
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null);
  /**
   * The active filters, named, for the sheet's button — see FilterSheet on why
   * the trigger has to carry this rather than being a bare icon.
   *
   * The category is counted but NOT offered inside the sheet: it is chosen by
   * tapping a row of "Where it went", which is a card on the page rather than
   * a control, and duplicating it here would give two places to set one thing.
   * Counting it is still right — it is filtering the list, so a button that
   * ignored it would under-report. Clearing does reset it, because "Clear all"
   * that left a category on would be a lie.
   */
  const summariseFilters = React.useCallback(
    (v: {
      period: Period;
      category: ExpenseCategory | null;
      sort: SortKey;
    }) => {
      const active: string[] = [];
      if (isPeriodFiltered(v.period)) active.push(t(periodLabelKey(v.period)));
      if (v.category) active.push(t(`category.${v.category}`));
      if (v.sort !== DEFAULT_SORT) active.push(t("filters.sort"));
      return active;
    },
    [t],
  );
  const [editing, setEditing] = React.useState<Expense | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Expense | undefined>();
  const [deleting, setDeleting] = React.useState(false);
  /** Bill waiting for the volunteer to say how it was actually paid. */
  const [toMarkPaid, setToMarkPaid] = React.useState<Expense | undefined>();
  /** Id of the bill currently being settled. */
  const [marking, setMarking] = React.useState<string | null>(null);

  // Marked on arrival, so a bill just recorded is findable in the list it
  // drops into — the same reason the receipts table does it.
  const arrived = useNewRows(
    React.useMemo(() => expenses.map((e) => e.id), [expenses]),
  );

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
    const clean = deferredQuery.trim().toLowerCase();
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
  }, [inPeriod, deferredQuery, category, sort, locale]);

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
          {/* Sits on the mesh rather than in a card, so it wears the pill. */}
          <Button
            size="sm"
            onClick={openCreate}
            className="glass-pill shrink-0 rounded-full"
          >
            <Plus /> {t("expenses.new")}
          </Button>
        </div>
        {/* From `sm` up the chip row stays as it was; below `sm` it collapses
            into the filter button beside the search box. */}
        <div className="hidden sm:block">
          <PeriodPresets period={period} onChange={setPeriod} />
        </div>
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

      {/* No wrapping pane: the rows carry the glass themselves, exactly as
          the activity feed's do. A pane around them made every row a
          nested surface, which is deliberately dimmer and flatter. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            {/* z-10 because the input now has a backdrop-filter, which makes it
                a stacking context: a non-positioned element that does so paints
                with the z-index:0 group, in tree order. The icon comes first in
                the DOM, so the field painted over it — and blurred it into its
                own backdrop. Measured, the stroke went from 671 to 261 (sum
                RGB) with this. */}
            <Search className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("expenses.search")}
              /* glass-pill: these sit on the mesh, not in a pane — the
                 wrapping Card came off when the rows were unnested, and the
                 base Input is bg-transparent, so without this the box was
                 just a border with text in it. Measured on the pill over the
                 darkest blob: placeholder 5.33:1, typed text 12.47:1. No
                 height: the 44px floor comes from @media (pointer: coarse). */
              className="glass-pill pl-8"
            />
          </div>
          {/* Phones get one filter button instead of the sort pill, the chip
              row above and the date box below. */}
          <FilterSheet
            value={{ period, category, sort }}
            defaults={{
              period: ALL_TIME,
              category: null as ExpenseCategory | null,
              sort: DEFAULT_SORT,
            }}
            onApply={(next) => {
              setPeriod(next.period);
              setCategory(next.category);
              setSort(next.sort);
            }}
            summarise={summariseFilters}
          >
            {(draft, patch) => (
              <>
                <FilterSection label={t("filters.period")}>
                  <PeriodPresets
                    period={draft.period}
                    onChange={(period) => patch({ period })}
                  />
                </FilterSection>
                <FilterSection label={t("filters.dates")}>
                  <CustomDateRange
                    period={draft.period}
                    onChange={(period) => patch({ period })}
                  />
                </FilterSection>
                <FilterSection label={t("filters.sort")}>
                  {/* An expense has no serial number, so those two orders are
                      not offered here rather than silently doing something
                      else. */}
                  <SortFilter
                    value={draft.sort}
                    onChange={(sort) => patch({ sort })}
                    keys={EXPENSE_SORT_KEYS}
                    showLabel
                    className="glass-pill"
                  />
                </FilterSection>
              </>
            )}
          </FilterSheet>
          {/* An expense has no serial number, so those two orders are not
            offered here rather than silently doing something else. */}
        <SortFilter
          value={sort}
          onChange={setSort}
          keys={EXPENSE_SORT_KEYS}
          className="glass-pill hidden sm:flex"
        />
        </div>
        <div className="hidden sm:block">
          <CustomDateRange period={period} onChange={setPeriod} />
        </div>

        {/* Phones get the card list below; the table starts at sm. */}
        <div className="glass-inset card-elevated hidden max-h-[70vh] overflow-auto rounded-xl border sm:block">
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
                  <TableRow
                    key={e.id}
                    className={cn(arrived.has(e.id) && "row-new")}
                  >
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
                      <div className="flex items-center justify-end gap-1">
                      {/* Settling a bill is the action a volunteer comes
                          to this row for, so it is a button rather than
                          two taps into a menu — and it names the sum, so
                          nothing is recorded as paid unseen. */}
                      {outstanding(e) > 0 ? (
                        <Button
                          size="sm"
                          onClick={() => setToMarkPaid(e)}
                          disabled={marking === e.id}
                        >
                          {marking === e.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Check />
                          )}
                          {t("expenses.payRemaining", {
                            amount: formatAmount(outstanding(e)),
                          })}
                        </Button>
                      ) : null}
                      <RowActions
                        onEdit={() => openEdit(e)}
                        onDelete={() => setToDelete(e)}
                        editLabel={t("table.edit")}
                        deleteLabel={t("table.delete")}
                      />
                      </div>
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
              <li
                key={e.id}
                className={cn(
                  "glass-inset card-elevated rounded-xl border p-3",
                  arrived.has(e.id) && "row-new [--row-new-end:var(--card)]",
                )}
              >
                {/* Laid out like the receipt card: what it was, then what
                    it cost, then the actions on their own row. Settling a
                    bill used to share a wrapping line with the category
                    badge and the date, where it landed in a different
                    place on every card. */}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="wrap-anywhere text-sm font-medium">
                      {e.description}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {t(`category.${e.category}`)}
                      </Badge>
                      <span>{t(`method.${e.payment_method}`)}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(e.spent_on, locale)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
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
                            "text-lg font-semibold tabular-nums",
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
                  </div>
                </div>

                {e.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.note}
                  </p>
                ) : null}
                {e.created_by_email ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName(e.created_by_email, names)}
                  </p>
                ) : null}

                {/* Real buttons rather than a hidden menu: on a phone
                    there is room, and edit and delete are the same two
                    icons the receipt card uses. `basis-0` keeps the pay
                    button from outgrowing its share when the amount is a
                    long one — a flex item cannot shrink below its own
                    label, which is what made the row jump about.

                    No sizes forced here: @media (pointer: coarse) in
                    globals.css puts a 44px floor under every button on a
                    phone, which is what makes this row thumb-sized. */}
                <div className="mt-3 flex gap-2">
                  {outstanding(e) > 0 ? (
                    <Button
                      className="min-w-0 flex-1 basis-0"
                      onClick={() => setToMarkPaid(e)}
                      disabled={marking === e.id}
                    >
                      {marking === e.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      {t("expenses.payRemaining", {
                        amount: formatAmount(outstanding(e)),
                      })}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={outstanding(e) > 0 ? undefined : "ml-auto"}
                    aria-label={t("table.edit")}
                    onClick={() => openEdit(e)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("table.delete")}
                    onClick={() => setToDelete(e)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

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
