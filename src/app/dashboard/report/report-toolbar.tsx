"use client";

import {
  ArrowDownUp,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import type { Donation, Expense, Receipt } from "@/lib/types";
import type { ReportRange, ReportStatus } from "./report-range";
import { SORT_KEYS, type SortKey } from "../sort-rows";

/** The dictionary takes literal keys, so each order's label is looked up. */
const SORT_LABELS = {
  "date-desc": "sort.newest",
  "date-asc": "sort.oldest",
  "amount-desc": "sort.amountHigh",
  "amount-asc": "sort.amountLow",
  "name-asc": "sort.az",
  "number-asc": "sort.numberAsc",
  "number-desc": "sort.numberDesc",
} as const;

type Labels = {
  statusAll: string;
  statusPaid: string;
  statusUnpaid: string;
  statusDonation: string;
  statusExpense: string;
  sort: string;
  today: string;
  all: string;
  from: string;
  to: string;
  export: string;
  back: string;
  pdf: string;
  excel: string;
};

/** `2026-08-01_2026-08-10`, `since-2026-08-01`, `all-time` — for a filename. */
function rangeSlug({ from, to }: ReportRange) {
  if (from && to) return from === to ? from : `${from}_${to}`;
  if (from) return `since-${from}`;
  if (to) return `upto-${to}`;
  return "all-time";
}

/**
 * The whole report toolbar: presets, the custom date pair, and print.
 *
 * The custom range is a native GET form rather than client state, so the URL is
 * always the full description of what is on the page — a volunteer can bookmark
 * "1st to 10th" or reload the print dialog without re-picking dates.
 */
export function ReportToolbar({
  range,
  status,
  sort,
  labels,
  receipts,
  donations,
  expenses,
  mandalName,
}: {
  range: ReportRange;
  status: ReportStatus;
  /** The printed order, carried in the URL like the range and the status. */
  sort: SortKey;
  labels: Labels;
  /** The rows on the page, so Excel exports exactly what is printed. */
  receipts: Receipt[];
  /** Exported as its own sheet — never merged into the receipts total. */
  donations: Donation[];
  /** Likewise its own sheet: money out, never netted against money in. */
  expenses: Expense[];
  mandalName: string;
}) {
  const { t, locale } = useI18n();

  async function exportExcel() {
    if (
      receipts.length === 0 &&
      donations.length === 0 &&
      expenses.length === 0
    ) {
      toast.error(t("toast.nothingToExport"));
      return;
    }
    // Loaded on the tap, not with the page: the xlsx writer is ~70KB of JS
    // that most visits to this page never use — they print instead.
    const { exportReceiptsToExcel } = await import("@/lib/export-excel");
    await exportReceiptsToExcel(
      receipts,
      dictionaries[locale],
      mandalName,
      rangeSlug(range),
      donations,
      expenses,
    );
    toast.success(
      t("toast.exported", {
        count: receipts.length + donations.length + expenses.length,
      }),
    );
  }

  /**
   * A link for one part of the selection that keeps the other part. Without
   * this, choosing "Unpaid" and then "Today" would silently drop the status.
   */
  const keep = (over: { range?: string; status?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const nextRange = over.range ?? range.key;
    if (nextRange === "today") p.set("range", "today");
    if (nextRange === "custom") {
      if (range.from) p.set("from", range.from);
      if (range.to) p.set("to", range.to);
    }
    const nextStatus =
      over.status ?? (status === "all" ? "" : status.toLowerCase());
    if (nextStatus) p.set("status", nextStatus);
    // Kept alongside the others, or picking a date range would silently reset
    // the printed order to oldest-first.
    const nextSort = over.sort ?? sort;
    if (nextSort !== "date-asc") p.set("sort", nextSort);
    const qs = p.toString();
    return qs ? `/dashboard/report?${qs}` : "/dashboard/report";
  };

  const presets = [
    { key: "today", href: keep({ range: "today" }), label: labels.today },
    { key: "all", href: keep({ range: "all" }), label: labels.all },
  ] as const;

  const statuses = [
    { key: "all", label: labels.statusAll },
    { key: "Paid", label: labels.statusPaid },
    { key: "Unpaid", label: labels.statusUnpaid },
    { key: "Donation", label: labels.statusDonation },
    { key: "Expense", label: labels.statusExpense },
  ] as const;

  return (
    // print:hidden keeps the toolbar out of the PDF itself.
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/receipts" />}
        >
          <ArrowLeft /> {labels.back}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" className="ml-auto">
                <Printer /> {labels.export}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.print()}>
              <FileText /> {labels.pdf}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportExcel}>
              <FileSpreadsheet /> {labels.excel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sorted by link, not by client state: the URL stays the whole
          description of what is on the page, so a print job can be
          bookmarked or reloaded in the order it was checked in. */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1.5">
        <span className="flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
          <ArrowDownUp className="size-3.5" /> {labels.sort}
        </span>
        {SORT_KEYS.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sort === key ? "secondary" : "ghost"}
            nativeButton={false}
            render={<Link href={keep({ sort: key })} />}
          >
            {t(SORT_LABELS[key])}
          </Button>
        ))}
      </div>

      <form
        // The date fields are uncontrolled, so a range picked elsewhere has to
        // arrive as a fresh instance; changing defaultValue in place is ignored.
        key={`${range.from ?? ""}:${range.to ?? ""}`}
        action="/dashboard/report"
        method="get"
        className="overflow-hidden rounded-lg border"
      >
        {/* Status sits with the ranges: both narrow what gets printed. */}
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
          {statuses.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={status === s.key ? "secondary" : "ghost"}
              nativeButton={false}
              render={
                <Link
                  href={keep({
                    status: s.key === "all" ? "" : s.key.toLowerCase(),
                  })}
                />
              }
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={range.key === p.key ? "secondary" : "ghost"}
              nativeButton={false}
              render={<Link href={p.href} />}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {status === "all" ? null : (
          <input type="hidden" name="status" value={status.toLowerCase()} />
        )}
        {sort === "date-asc" ? null : (
          <input type="hidden" name="sort" value={sort} />
        )}

        <div className="flex flex-wrap items-end gap-2 p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              {labels.from}
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={range.from ?? ""}
              className="w-40"
              // Applied as soon as a date is picked — same as the custom
              // range everywhere else in the app, no separate Apply step.
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              {labels.to}
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={range.to ?? ""}
              className="w-40"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
