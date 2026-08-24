"use client";

import * as React from "react";
import { FilePlus2, Gift, Pencil, Trash2, User, Wallet } from "lucide-react";
import type {
  ActivityEntity,
  ActivityEntry,
  AuditAction,
  ExpenseCategory,
  NameMap,
  PaymentStatus,
} from "@/lib/types";
import {
  dayOf,
  formatAmount,
  formatDate,
  formatTime,
  displayName,
} from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ALL_TIME,
  inPeriod,
  PeriodFilter,
  type Period,
} from "../period-filter";

const ACTION_FILTERS = [
  { key: "all", labelKey: "activity.filterAll" },
  { key: "created", labelKey: "activity.filterCreated" },
  { key: "updated", labelKey: "activity.filterEdits" },
  { key: "deleted", labelKey: "activity.filterDeletes" },
] as const;

const ICONS: Record<AuditAction, React.ElementType> = {
  created: FilePlus2,
  updated: Pencil,
  deleted: Trash2,
};

/** Which ledger to show. `all` keeps the feed a single chronological list. */
const LEDGERS = [
  { key: "all", labelKey: "activity.allLedgers" },
  { key: "receipt", labelKey: "activity.contributions" },
  { key: "expense", labelKey: "activity.expenses" },
  { key: "donation", labelKey: "activity.donations" },
] as const;

const LEDGER_ICONS: Partial<Record<ActivityEntity, React.ElementType>> = {
  expense: Wallet,
  donation: Gift,
};

/**
 * Only these columns are worth showing a diff for, per entity — the two tables
 * have different shapes, and a snapshot carries every column.
 */
const TRACKED: Record<ActivityEntity, readonly string[]> = {
  receipt: [
    "donor_name",
    "amount",
    "phone_number",
    "payment_method",
    "collection_date",
    // Without these, marking a pledge received logged an "edited" entry with
    // no visible change — the one edit most worth seeing in the log.
    "payment_status",
    "due_on",
  ],
  expense: [
    "description",
    "amount",
    "category",
    "payment_method",
    "spent_on",
    "note",
  ],
  donation: ["donor_name", "phone_number", "item", "value", "donation_date"],
};

export function ActivityList({
  entries,
  names,
}: {
  entries: ActivityEntry[];
  names: NameMap;
}) {
  const { t, locale } = useI18n();
  const [ledger, setLedger] = React.useState<"all" | ActivityEntity>("all");
  const [action, setAction] = React.useState<"all" | AuditAction>("all");
  const [actor, setActor] = React.useState<string>("all");
  const [period, setPeriod] = React.useState<Period>(ALL_TIME);

  const volunteers = React.useMemo(
    () =>
      [...new Set(entries.map((e) => e.actor_email).filter(Boolean))].sort() as string[],
    [entries],
  );

  const visible = React.useMemo(() => {
    return entries.filter(
      (e) =>
        (ledger === "all" || e.entity === ledger) &&
        (action === "all" || e.action === action) &&
        (actor === "all" || e.actor_email === actor) &&
        inPeriod(dayOf(e.changed_at), period),
    );
  }, [entries, ledger, action, actor, period]);

  /** Grouped under one heading per day, newest day first. */
  const days = React.useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const e of visible) {
      const day = dayOf(e.changed_at);
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const show = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "amount" || field === "value") return formatAmount(Number(value));
    if (field === "collection_date" || field === "spent_on" || field === "donation_date")
      return formatDate(String(value), locale);
    if (field === "payment_method")
      return t(`method.${String(value) as "Cash" | "UPI"}`);
    if (field === "category")
      return t(`category.${String(value) as ExpenseCategory}`);
    if (field === "due_on") return formatDate(String(value), locale);
    if (field === "payment_status")
      return t(`status.${String(value) as PaymentStatus}`);
    return String(value);
  };

  const fieldLabel = (field: string) =>
    ({
      donor_name: t("table.donor"),
      amount: t("table.amount"),
      phone_number: t("table.mobile"),
      payment_method: t("table.method"),
      collection_date: t("table.date"),
      description: t("expenses.description"),
      category: t("expenses.category"),
      spent_on: t("expenses.date"),
      note: t("expenses.note"),
      payment_status: t("status.field"),
      due_on: t("form.dueOn"),
      item: t("donation.item"),
      value: t("donation.value"),
      donation_date: t("donation.date"),
    })[field] ?? field;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
          {t("activity.title")}
        </h1>
        {volunteers.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="mt-1 max-w-56">
                  <User />
                  <span className="truncate">
                    {actor === "all"
                      ? t("activity.allVolunteers")
                      : displayName(actor, names)}
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setActor("all")}>
                {t("activity.allVolunteers")}
              </DropdownMenuItem>
              {volunteers.map((email) => (
                <DropdownMenuItem key={email} onClick={() => setActor(email)}>
                  {displayName(email, names)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Which ledger first, since it changes what the rest of the filters are
          filtering. Its own row so the two levels read as a hierarchy. */}
      <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:w-fit sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
        {LEDGERS.map(({ key, labelKey }) => {
          const Icon = LEDGER_ICONS[key as ActivityEntity];
          return (
            <Button
              key={key}
              size="sm"
              variant={ledger === key ? "secondary" : "outline"}
              className="shrink-0 sm:border-transparent sm:shadow-none"
              onClick={() => setLedger(key)}
            >
              {Icon ? <Icon /> : null}
              {t(labelKey)}
            </Button>
          );
        })}
      </div>

      {/* Who, what, when — all three filters in one row. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:rounded-lg sm:border sm:p-0.5 sm:px-0.5">
          {ACTION_FILTERS.map(({ key, labelKey }) => (
            <Button
              key={key}
              size="sm"
              variant={action === key ? "secondary" : "outline"}
              className="shrink-0 sm:border-transparent sm:shadow-none"
              onClick={() => setAction(key)}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <PeriodFilter period={period} onChange={setPeriod} />
        </div>
      </div>

      {days.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-10 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? t("activity.empty")
                : t("activity.noneInPeriod")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {days.map(([day, dayEntries]) => (
            <section key={day} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base">
                  {formatDate(day, locale)}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t("activity.dayCount", { count: dayEntries.length })}
                </span>
              </div>

              <ol className="flex flex-col gap-2">
                {dayEntries.map((entry) => {
                  const Icon = ICONS[entry.action];
                  const snapshot = entry.after ?? entry.before;
                  const changes =
                    entry.action === "updated" && entry.before && entry.after
                      ? TRACKED[entry.entity].filter(
                          (f) =>
                            String(entry.before?.[f] ?? "") !==
                            String(entry.after?.[f] ?? ""),
                        )
                      : [];

                  // Snapshots are whole rows of three differently shaped
                  // tables, so what to show is picked per entity rather than
                  // read off one shared column name.
                  const glyph =
                    entry.entity === "expense"
                      ? Wallet
                      : entry.entity === "donation"
                        ? Gift
                        : Icon;
                  const label =
                    entry.entity === "expense"
                      ? t("activity.expenseLabel")
                      : entry.entity === "donation"
                        ? t("activity.donationNo", {
                            number: String(snapshot?.donation_number ?? "—"),
                          })
                        : t("activity.receiptNo", {
                            number: entry.receipt_number ?? "—",
                          });
                  const title =
                    entry.entity === "expense"
                      ? String(snapshot?.description ?? "")
                      : String(snapshot?.donor_name ?? "");
                  // Only a donation carries a second descriptive bit (what
                  // was given) alongside who gave it.
                  const detail =
                    entry.entity === "donation"
                      ? String(snapshot?.item ?? "")
                      : null;
                  // A donation's value is an optional note for the record,
                  // not money the mandal received or spent — it gets no
                  // +/- sign and no flow colour, unlike the other two.
                  const isDonation = entry.entity === "donation";
                  const rawFigure = isDonation ? snapshot?.value : snapshot?.amount;
                  const figure =
                    rawFigure === null || rawFigure === undefined
                      ? null
                      : formatAmount(Number(rawFigure));

                  return (
                    <li
                      key={entry.entry_key}
                      className="card-elevated rounded-xl border bg-card p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {/* The ledger is readable from the icon before any
                              text is read: a wallet means money going out. */}
                          {(() => {
                            const Glyph = glyph;
                            return (
                              <Glyph
                                className={cn(
                                  "size-4",
                                  entry.action === "deleted" && "text-destructive",
                                  entry.action === "created" && "text-positive-ink",
                                  entry.action === "updated" && "text-pending-ink",
                                )}
                              />
                            );
                          })()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                            <Badge
                              variant={
                                entry.action === "deleted"
                                  ? "destructive"
                                  : entry.action === "created"
                                    ? "positive"
                                    : "warning"
                              }
                            >
                              {t(`activity.${entry.action}`)}
                            </Badge>
                            <span className="font-medium">{label}</span>
                            {snapshot ? (
                              <span className="wrap-anywhere text-muted-foreground">
                                · {title}
                                {detail ? <> · {detail}</> : null}
                                {figure !== null ? (
                                  <>
                                    {" "}
                                    ·{" "}
                                    {/* The sign is what says which way the
                                        money went; the colour repeats it. A
                                        donation's value is neither, so it
                                        gets plain ink. */}
                                    <span
                                      className={cn(
                                        "tabular-nums",
                                        // A deleted row's amount is what it
                                        // used to be. Showing it as a live
                                        // inflow next to a red "deleted"
                                        // badge would claim money that never
                                        // landed, so it is struck instead.
                                        entry.action === "deleted"
                                          ? "text-muted-foreground line-through"
                                          : isDonation
                                            ? "text-foreground"
                                            : entry.entity === "expense"
                                              ? "text-destructive"
                                              : "text-positive-ink",
                                      )}
                                    >
                                      {entry.action === "deleted" || isDonation
                                        ? ""
                                        : entry.entity === "expense"
                                          ? "\u2212"
                                          : "+"}
                                      {figure}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            ) : null}
                          </p>

                          {changes.length > 0 ? (
                            <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                              {changes.map((f) => (
                                <li key={f} className="wrap-anywhere">
                                  {t("activity.changed", {
                                    field: fieldLabel(f),
                                    from: show(f, entry.before?.[f]),
                                    to: show(f, entry.after?.[f]),
                                  })}
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatTime(entry.changed_at, locale)} ·{" "}
                            {t("activity.by", {
                              who:
                                displayName(entry.actor_email, names) ?? "—",
                            })}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
