"use client";

import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react";
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
import { exportReceiptsToExcel } from "@/lib/export-excel";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import type { Receipt } from "@/lib/types";
import type { ReportRange } from "./report-range";

type Labels = {
  today: string;
  all: string;
  from: string;
  to: string;
  apply: string;
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
  labels,
  receipts,
  mandalName,
}: {
  range: ReportRange;
  labels: Labels;
  /** The rows on the page, so Excel exports exactly what is printed. */
  receipts: Receipt[];
  mandalName: string;
}) {
  const { t, locale } = useI18n();

  async function exportExcel() {
    if (receipts.length === 0) {
      toast.error(t("toast.nothingToExport"));
      return;
    }
    await exportReceiptsToExcel(
      receipts,
      dictionaries[locale],
      mandalName,
      rangeSlug(range),
    );
    toast.success(t("toast.exported", { count: receipts.length }));
  }

  const presets = [
    {
      key: "today",
      href: "/dashboard/report?range=today",
      label: labels.today,
    },
    { key: "all", href: "/dashboard/report", label: labels.all },
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

      <form
        // The date fields are uncontrolled, so a range picked elsewhere has to
        // arrive as a fresh instance; changing defaultValue in place is ignored.
        key={`${range.from ?? ""}:${range.to ?? ""}`}
        action="/dashboard/report"
        method="get"
        className="overflow-hidden rounded-lg border"
      >
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
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant={range.key === "custom" ? "secondary" : "outline"}
          >
            {labels.apply}
          </Button>
        </div>
      </form>
    </div>
  );
}
