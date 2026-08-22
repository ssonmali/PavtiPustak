"use client";

import * as React from "react";
import { FilePlus2, Pencil, Trash2, User } from "lucide-react";
import type { AuditAction, AuditEntry } from "@/lib/types";
import {
  dayOf,
  formatAmount,
  formatDate,
  formatTime,
} from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PeriodFilter, startOf, type Period } from "../period-filter";

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

/** Only these columns are worth showing a diff for. */
const TRACKED = [
  "donor_name",
  "amount",
  "phone_number",
  "payment_method",
  "collection_date",
] as const;

export function ActivityList({ entries }: { entries: AuditEntry[] }) {
  const { t, locale } = useI18n();
  const [action, setAction] = React.useState<"all" | AuditAction>("all");
  const [actor, setActor] = React.useState<string>("all");
  const [period, setPeriod] = React.useState<Period>(0);

  const volunteers = React.useMemo(
    () =>
      [...new Set(entries.map((e) => e.actor_email).filter(Boolean))].sort() as string[],
    [entries],
  );

  const visible = React.useMemo(() => {
    const from = startOf(period);
    return entries.filter(
      (e) =>
        (action === "all" || e.action === action) &&
        (actor === "all" || e.actor_email === actor) &&
        (!from || dayOf(e.changed_at) >= from),
    );
  }, [entries, action, actor, period]);

  /** Grouped under one heading per day, newest day first. */
  const days = React.useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of visible) {
      const day = dayOf(e.changed_at);
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const show = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "amount") return formatAmount(Number(value));
    if (field === "collection_date") return formatDate(String(value), locale);
    if (field === "payment_method")
      return t(`method.${String(value) as "Cash" | "UPI"}`);
    return String(value);
  };

  const fieldLabel = (field: string) =>
    ({
      donor_name: t("table.donor"),
      amount: t("table.amount"),
      phone_number: t("table.mobile"),
      payment_method: t("table.method"),
      collection_date: t("table.date"),
    })[field] ?? field;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("activity.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("activity.subtitle")}</p>
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
          {volunteers.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="max-w-48">
                    <User />
                    <span className="truncate">
                      {actor === "all" ? t("activity.allVolunteers") : actor}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActor("all")}>
                  {t("activity.allVolunteers")}
                </DropdownMenuItem>
                {volunteers.map((email) => (
                  <DropdownMenuItem key={email} onClick={() => setActor(email)}>
                    {email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

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
                <h2 className="text-sm font-medium">
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
                      ? TRACKED.filter(
                          (f) =>
                            String(entry.before?.[f] ?? "") !==
                            String(entry.after?.[f] ?? ""),
                        )
                      : [];

                  return (
                    <li key={entry.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon
                            className={
                              entry.action === "deleted"
                                ? "size-4 text-destructive"
                                : "size-4 text-muted-foreground"
                            }
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                            <Badge
                              variant={
                                entry.action === "deleted"
                                  ? "destructive"
                                  : entry.action === "created"
                                    ? "outline"
                                    : "secondary"
                              }
                            >
                              {t(`activity.${entry.action}`)}
                            </Badge>
                            <span className="font-medium">
                              {t("activity.receiptNo", {
                                number: entry.receipt_number ?? "—",
                              })}
                            </span>
                            {snapshot ? (
                              <span className="wrap-anywhere text-muted-foreground">
                                · {snapshot.donor_name} ·{" "}
                                <span className="tabular-nums">
                                  {formatAmount(snapshot.amount)}
                                </span>
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
                              who: entry.actor_email ?? "—",
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
