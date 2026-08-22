"use client";

import * as React from "react";
import {
  Download,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Printer,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteReceipt, fetchReceipts } from "@/app/actions/receipts";
import { exportReceiptsToExcel } from "@/lib/export-excel";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Receipt } from "@/lib/types";
import {
  formatAmount,
  formatDate,
  receiptsToCsv,
  whatsappUrl,
} from "@/lib/receipt-utils";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { ReceiptDialog } from "./receipt-dialog";
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

export function ReceiptsTable({
  receipts,
  mandalName,
  periodDays = 0,
  total,
}: {
  receipts: Receipt[];
  mandalName: string;
  /** Mirrors the dashboard period so the PDF report covers the same window. */
  periodDays?: number;
  /** Total rows on the server, when the list is paginated. */
  total?: number;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [loadingMore, setLoadingMore] = React.useState(false);

  // The server sends the first page; further pages append here. A realtime
  // refresh replaces `receipts`, which changes the key and drops the stale
  // tail — derived rather than reset in an effect.
  const pageKey = `${receipts.length}:${receipts[0]?.id ?? ""}`;
  const [tail, setTail] = React.useState<{ key: string; rows: Receipt[] }>({
    key: pageKey,
    rows: [],
  });
  const all = React.useMemo(
    () => [...receipts, ...(tail.key === pageKey ? tail.rows : [])],
    [receipts, tail, pageKey],
  );
  const hasMore = typeof total === "number" && all.length < total;

  async function loadMore() {
    setLoadingMore(true);
    const { rows } = await fetchReceipts(all.length);
    setTail((prev) => ({
      key: pageKey,
      rows: prev.key === pageKey ? [...prev.rows, ...rows] : rows,
    }));
    setLoadingMore(false);
  }
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Receipt | undefined>();
  const [toDelete, setToDelete] = React.useState<Receipt | undefined>();
  const [deleting, setDeleting] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.donor_name.toLowerCase().includes(q) ||
        r.phone_number.includes(q) ||
        String(r.receipt_number) === q,
    );
  }, [all, query]);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(receipt: Receipt) {
    setEditing(receipt);
    setDialogOpen(true);
  }

  function sendWhatsApp(receipt: Receipt) {
    window.open(whatsappUrl(receipt, mandalName), "_blank", "noopener");
  }

  async function exportExcel() {
    if (!filtered.length) {
      toast.error(t("toast.nothingToExport"));
      return;
    }
    await exportReceiptsToExcel(filtered, dictionaries[locale], mandalName);
    toast.success(t("toast.exported", { count: filtered.length }));
  }

  /** Opens the print-ready report; the browser's dialog saves it as PDF. */
  function openPdf() {
    window.open(`/dashboard/report?days=${periodDays}`, "_blank", "noopener");
  }

  function exportCsv() {
    if (!filtered.length) {
      toast.error(t("toast.nothingToExport"));
      return;
    }
    const blob = new Blob([receiptsToCsv(filtered)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pavti-pustak-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("toast.exported", { count: filtered.length }));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteReceipt(toDelete.id);
    setDeleting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("toast.conflict"));
      return;
    }
    toast.success(t("toast.deleted", { number: toDelete.receipt_number }));
    setToDelete(undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("table.search")}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download /> {t("table.export")}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet /> {t("export.excel")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openPdf}>
                <FileText /> {t("export.pdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>
                <Download /> {t("export.csv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus /> {t("table.new")}
          </Button>
        </div>
      </div>

      {/* Phones get the card list below; the table starts at sm. */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">{t("table.no")}</TableHead>
              <TableHead>{t("table.donor")}</TableHead>
              <TableHead className="text-right">{t("table.amount")}</TableHead>
              <TableHead>{t("table.mobile")}</TableHead>
              <TableHead>{t("table.method")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead className="w-24 text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {all.length === 0 ? t("table.empty") : t("table.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {receipt.receipt_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    {receipt.donor_name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(receipt.amount)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {receipt.phone_number}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        receipt.payment_method === "UPI" ? "default" : "secondary"
                      }
                    >
                      {t(`method.${receipt.payment_method}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(receipt.collection_date, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendWhatsApp(receipt)}
                        title={t("table.sendTitle", { name: receipt.donor_name })}
                      >
                        <MessageCircle /> {t("table.send")}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="icon" variant="ghost" title="More">
                              <MoreHorizontal />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(receipt)}>
                            <Pencil /> {t("table.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/dashboard/receipts/${receipt.id}`,
                                "_blank",
                                "noopener",
                              )
                            }
                          >
                            <Printer /> {t("table.print")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setToDelete(receipt)}
                          >
                            <Trash2 /> {t("table.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: one card per receipt — no horizontal scrolling, thumb-sized
          actions, and the amount is the most prominent thing on the row. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {filtered.length === 0 ? (
          <li className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            {all.length === 0 ? t("table.empty") : t("table.noMatch")}
          </li>
        ) : (
          filtered.map((receipt) => (
            <li key={receipt.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere font-medium">
                    {receipt.donor_name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      #{receipt.receipt_number}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{receipt.phone_number}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(receipt.collection_date, locale)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-base font-semibold tabular-nums">
                    {formatAmount(receipt.amount)}
                  </span>
                  <Badge
                    variant={
                      receipt.payment_method === "UPI" ? "default" : "secondary"
                    }
                  >
                    {t(`method.${receipt.payment_method}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => sendWhatsApp(receipt)}
                >
                  <MessageCircle /> {t("table.send")}
                </Button>
                <Button variant="ghost" onClick={() => openEdit(receipt)}>
                  <Pencil /> {t("table.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("table.print")}
                  onClick={() =>
                    window.open(
                      `/dashboard/receipts/${receipt.id}`,
                      "_blank",
                      "noopener",
                    )
                  }
                >
                  <Printer />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("table.delete")}
                  onClick={() => setToDelete(receipt)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-col items-center gap-2">
        {filtered.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("table.showing", {
              shown: filtered.length,
              total: total ?? all.length,
            })}
          </p>
        ) : null}

        {hasMore && !query ? (
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="animate-spin" /> : null}
            {t("table.loadMore")}
          </Button>
        ) : null}
      </div>

      <ReceiptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        receipt={editing}
      />

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => {
          if (!open) setToDelete(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.body", {
                number: toDelete?.receipt_number ?? "",
                name: toDelete?.donor_name ?? "",
                amount: toDelete ? formatAmount(toDelete.amount) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? t("delete.deleting") : t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
