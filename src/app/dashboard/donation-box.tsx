"use client";

import * as React from "react";
import { toast } from "sonner";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteDonation } from "@/app/actions/donations";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount, formatDate } from "@/lib/receipt-utils";
import type { Donation } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonationDialog } from "./donation-dialog";

/**
 * A distinct hue from every other badge in the app (UPI orange, Cash blue,
 * unpaid amber, positive/destructive green/red) — a donation-box entry is
 * neither of those, so it reads as its own thing at a glance.
 */
function DonationBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: "color-mix(in oklab, #8b5cf6 35%, transparent)",
        background: "color-mix(in oklab, #8b5cf6 12%, transparent)",
      }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: "#8b5cf6" }} />
      {label}
    </span>
  );
}

/**
 * The donation box: in-kind or informal donations, logged separately from
 * vargani and expenses so neither total ever includes them. Deliberately no
 * search/sort/period controls — this is a low-volume log, not a scaling
 * ledger.
 */
export function DonationBox({ donations }: { donations: Donation[] }) {
  const { t, locale } = useI18n();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Donation | undefined>();
  const [toDelete, setToDelete] = React.useState<Donation | undefined>();
  const [deleting, setDeleting] = React.useState(false);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(donation: Donation) {
    setEditing(donation);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteDonation(toDelete.id);
    setDeleting(false);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("donation.conflict"));
      return;
    }
    toast.success(t("donation.deleted", { number: toDelete.donation_number }));
    setToDelete(undefined);
  }

  return (
    <Card className="card-elevated">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-4 text-muted-foreground" />
            {t("donation.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("donation.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus /> {t("donation.new")}
        </Button>
      </CardHeader>
      <CardContent>
        {donations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("donation.empty")}
          </p>
        ) : (
          <>
            {/* Phones get the card list below; the table starts at sm. */}
            <div className="hidden overflow-auto rounded-xl border sm:block">
              <Table className="table-zebra table-sticky">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">{t("donation.number")}</TableHead>
                    <TableHead>{t("donation.donor")}</TableHead>
                    <TableHead>{t("donation.item")}</TableHead>
                    <TableHead className="text-right">
                      {t("donation.value")}
                    </TableHead>
                    <TableHead>{t("donation.date")}</TableHead>
                    <TableHead className="w-28 text-right">
                      {t("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {donation.donation_number}
                      </TableCell>
                      <TableCell>
                        <div className="wrap-anywhere">{donation.donor_name}</div>
                        {donation.phone_number ? (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {donation.phone_number}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="wrap-anywhere">
                        {donation.item}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {donation.value != null
                          ? formatAmount(donation.value)
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(donation.donation_date, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("table.edit")}
                            onClick={() => openEdit(donation)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("table.delete")}
                            onClick={() => setToDelete(donation)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-2 sm:hidden">
              {donations.map((donation) => (
                <div key={donation.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="wrap-anywhere text-sm font-medium">
                        {donation.donor_name}
                      </p>
                      {donation.phone_number ? (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {donation.phone_number}
                        </p>
                      ) : null}
                    </div>
                    <DonationBadge label={t("donation.badge")} />
                  </div>
                  <p className="mt-2 wrap-anywhere text-sm">{donation.item}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(donation.donation_date, locale)}</span>
                    {donation.value != null ? (
                      <span className="tabular-nums">
                        · {formatAmount(donation.value)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEdit(donation)}
                    >
                      <Pencil /> {t("table.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setToDelete(donation)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        // Remounts the form when switching from editing one row to another
        // (or to "new"), so uncontrolled defaultValues reset correctly.
        key={editing?.id ?? "new"}
      >
        {dialogOpen ? (
          <DonationDialog donation={editing} onOpenChange={setDialogOpen} />
        ) : null}
      </Dialog>

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("donation.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("donation.deleteBody", {
                name: toDelete?.donor_name ?? "",
                item: toDelete?.item ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? t("delete.deleting") : t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
