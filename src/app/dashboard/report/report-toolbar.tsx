"use client";

import * as React from "react";
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { reportUrl, type ReportRange, type ReportStatus } from "./report-range";
import { type SortKey } from "../sort-rows";
import { SortFilter } from "../sort-filter";
import { FilterSection, FilterSheet } from "@/components/filter-sheet";

type Labels = {
  statusAll: string;
  statusPaid: string;
  statusUnpaid: string;
  statusDonation: string;
  statusExpense: string;
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
  const router = useRouter();
  /* Distinct from the "from"/"to" ids on the desktop form above, which is in
     the document at the same time: duplicate ids point both labels at
     whichever field came first, so tapping "To" in the sheet focused the
     hidden desktop "From". */
  const sheetId = React.useId();
  const sheetFromId = `${sheetId}-from`;
  const sheetToId = `${sheetId}-to`;

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
  const keep = (over: {
    range?: string;
    status?: string;
    sort?: string;
    /** Explicit bounds, for callers that navigate rather than submit. */
    from?: string | null;
    to?: string | null;
  }) => {
    const p = new URLSearchParams();
    const dated = over.from !== undefined || over.to !== undefined;
    const nextRange = over.range ?? (dated ? "custom" : range.key);
    if (nextRange === "today") p.set("range", "today");
    if (nextRange === "custom") {
      // `?? range.x` rather than `|| range.x`: an explicit null is "clear this
      // bound", which || would silently reinstate from the current range.
      const from = over.from !== undefined ? over.from : range.from;
      const to = over.to !== undefined ? over.to : range.to;
      if (from) p.set("from", from);
      if (to) p.set("to", to);
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

  /**
   * The active filters, named — for the trigger and the sheet's own line.
   *
   * Derived from the value passed in rather than tracked separately, so it
   * cannot disagree with what is on the page. That matters more here than
   * anywhere else in the app: this is the screen a treasurer prints from, and
   * a printed sheet that silently covers only part of the ledger is the worst
   * version of the mistake a hidden filter invites. Sort is counted but
   * unnamed, as on the other tabs.
   */
  const summariseFilters = (v: {
    status: ReportStatus;
    range: ReportRange;
    sort: SortKey;
  }) => {
    const active: string[] = [];
    if (v.status !== "all") {
      active.push(statuses.find((s) => s.key === v.status)?.label ?? v.status);
    }
    if (v.range.key === "today") active.push(labels.today);
    if (v.range.key === "custom") active.push(t("period.custom"));
    if (v.sort !== "date-asc") active.push(t("filters.sort"));
    return active;
  };

  return (
    // print:hidden keeps the toolbar out of the PDF itself.
    <div className="flex flex-col gap-3 print:hidden">
      {/* The outline/default pairing matches PrintBar's back+print row on the
          single-receipt page — the other screen built around .paper. Sizes
          are the desktop density; @media (pointer: coarse) in globals.css
          puts a 44px floor under both on a phone. */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
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

      {/* A glass pane, like every other filter surface in the app — this was
          a bare `border` with flat bg-muted/40 bands inside it, which is why
          it read as a different, older screen next to the receipts and
          expenses toolbars. Same pane, same rounded-full chip row; no
          glass-pill on the chips themselves, for the same reason the from/to
          box doesn't put one on its date inputs — a pill stacked inside a
          pane it is already sitting on compounds two veils into a white
          patch.

          Kept as a real GET form and shown from `sm` up. The phone sheet
          below cannot reuse it: a dialog portals to <body>, which would move
          these inputs OUT of the form element and drop them from the submit
          without any visible sign — so the sheet navigates instead. */}
      <form
        // The date fields are uncontrolled, so a range picked elsewhere has to
        // arrive as a fresh instance; changing defaultValue in place is ignored.
        key={`${range.from ?? ""}:${range.to ?? ""}`}
        action="/dashboard/report"
        method="get"
        className="glass-inset hidden flex-col gap-3 rounded-lg border p-3 sm:flex"
      >
        {/* Status sits with the ranges: both narrow what gets printed. */}
        <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3">
          {statuses.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={status === s.key ? "secondary" : "outline"}
              className="shrink-0 rounded-full"
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

        <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={range.key === p.key ? "secondary" : "outline"}
              className="shrink-0 rounded-full"
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

        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              {labels.from}
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={range.from ?? ""}
              className="w-full min-w-0 sm:w-40"
              // Applied as soon as a date is picked — same as the custom
              // range everywhere else in the app, no separate Apply step.
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              {labels.to}
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={range.to ?? ""}
              className="w-full min-w-0 sm:w-40"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
          <span className="shrink-0 sm:ml-auto">
            <SortFilter
              value={sort}
              onChange={(key) => router.push(keep({ sort: key }))}
            />
          </span>
        </div>
      </form>

      {/* The same controls for a phone. Chips are already <Link>s so they
          work anywhere; the dates navigate on change instead of submitting,
          which is what lets them live inside a portalled dialog at all. The
          URL still ends up describing the page, so a bookmarked or reloaded
          report is unaffected either way it was set. */}
      <div className="sm:hidden">
        <FilterSheet
          value={{ status, range, sort }}
          defaults={{
            status: "all" as ReportStatus,
            range: { key: "all", from: null, to: null } as ReportRange,
            sort: "date-asc" as SortKey,
          }}
          /* One navigation for the whole selection. These chips are <Link>s on
             desktop, which is right for one deliberate tap — but in a sheet
             where a volunteer sets status, period and order before looking at
             anything, that was three page loads to reach one report. */
          onApply={(next) => router.push(reportUrl(next))}
          summarise={summariseFilters}
        >
          {(draft, patch) => (
            <>
              <FilterSection label={t("filters.status")}>
                <div className="-mx-1 flex flex-wrap items-center gap-1 px-1">
                  {statuses.map((s) => (
                    <Button
                      key={s.key}
                      size="sm"
                      variant={draft.status === s.key ? "secondary" : "outline"}
                      className="shrink-0 rounded-full"
                      onClick={() => patch({ status: s.key })}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection label={t("filters.period")}>
                <div className="-mx-1 flex flex-wrap items-center gap-1 px-1">
                  {presets.map((p) => (
                    <Button
                      key={p.key}
                      size="sm"
                      variant={
                        draft.range.key === p.key ? "secondary" : "outline"
                      }
                      className="shrink-0 rounded-full"
                      onClick={() =>
                        patch({
                          // A preset drops any custom bounds, exactly as
                          // navigating to it does on desktop.
                          range: { key: p.key, from: null, to: null },
                        })
                      }
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection label={t("filters.dates")}>
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Label
                      htmlFor={sheetFromId}
                      className="text-xs text-muted-foreground"
                    >
                      {labels.from}
                    </Label>
                    <Input
                      id={sheetFromId}
                      type="date"
                      value={draft.range.from ?? ""}
                      max={draft.range.to ?? undefined}
                      className="w-full min-w-0"
                      onChange={(e) =>
                        patch({
                          range: {
                            // Typing a date IS choosing the custom range.
                            key: "custom",
                            from: e.target.value || null,
                            to: draft.range.to,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Label
                      htmlFor={sheetToId}
                      className="text-xs text-muted-foreground"
                    >
                      {labels.to}
                    </Label>
                    <Input
                      id={sheetToId}
                      type="date"
                      value={draft.range.to ?? ""}
                      min={draft.range.from ?? undefined}
                      className="w-full min-w-0"
                      onChange={(e) =>
                        patch({
                          range: {
                            key: "custom",
                            from: draft.range.from,
                            to: e.target.value || null,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </FilterSection>

              <FilterSection label={t("filters.sort")}>
                <SortFilter
                  value={draft.sort}
                  onChange={(sort) => patch({ sort })}
                  showLabel
                />
              </FilterSection>
            </>
          )}
        </FilterSheet>
      </div>
    </div>
  );
}
