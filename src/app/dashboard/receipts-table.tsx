"use client";

import * as React from "react";
import {
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Printer,
  CloudOff,
  Search,
  Check,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteReceipt,
  fetchReceipts,
  markReceiptPaid,
} from "@/app/actions/receipts";
import type { LocalReceipt, OutboxEntry } from "@/lib/offline";
import { useReceiptShare } from "@/lib/use-receipt-share";
import { PAYMENT_METHODS, type NameMap, type PaymentMethod } from "@/lib/types";
import type { Editors } from "@/lib/use-editing-presence";
import {
  formatAmount,
  formatDate,
  isFullyPaid,
  isPartPaid,
  outstanding,
  received,
  todayInIst,
} from "@/lib/receipt-utils";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ReceiptDialog } from "./receipt-dialog";
import { SortFilter } from "./sort-filter";
import { DEFAULT_SORT, sortRows, type SortKey } from "./sort-rows";
import { CustomDateRange, type Period } from "./period-filter";
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

/**
 * Cash and UPI wear the same two hues as the chart series, so a volunteer
 * learns one mapping rather than two. Tinted rather than solid: a badge is a
 * label, not a data mark competing with the bars.
 */
function MethodBadge({
  method,
  label,
}: {
  method: "Cash" | "UPI";
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: `color-mix(in oklab, ${method === "UPI" ? "#eb6834" : "#2a78d6"} 35%, transparent)`,
        background: `color-mix(in oklab, ${method === "UPI" ? "#eb6834" : "#2a78d6"} 12%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: method === "UPI" ? "#eb6834" : "#2a78d6" }}
      />
      {label}
    </span>
  );
}

/**
 * An unpaid row is money the mandal does not have yet, so it is marked
 * wherever the amount appears — an amount that reads as collected when it has
 * not been is the one error worth being loud about.
 */
function UnpaidBadge({
  dueOn,
  today,
  label,
  title,
}: {
  dueOn: string | null;
  today: string;
  label: string;
  title: string;
}) {
  const overdue = Boolean(dueOn) && dueOn! < today;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        overdue
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-pending/45 bg-pending/15 text-foreground",
      )}
    >
      <Clock aria-hidden className="size-3" />
      {label}
    </span>
  );
}

/**
 * Someone else has this row open. Shown before the edit is attempted, so a
 * volunteer can wait rather than discover the clash at save time.
 */
function EditingBadge({ label }: { label: string }) {
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
      <Pencil aria-hidden className="size-3 shrink-0" />
      {label}
    </span>
  );
}

type QueueFn = (
  entry: Omit<OutboxEntry, "localId" | "queuedAt" | "attempts">,
) => Promise<void>;

/** Lets the page header open the create dialog this component owns. */
export type ReceiptsTableHandle = { openCreate: () => void };

export function ReceiptsTable({
  receipts,
  mandalName,
  names,
  total,
  online = true,
  queue,
  editors,
  setPresence,
  period,
  onPeriodChange,
  ref,
}: {
  receipts: LocalReceipt[];
  mandalName: string;
  /** Volunteer display names, for the "collected by" line on the image. */
  names: NameMap;
  /** Total rows on the server, when the list is paginated. */
  total?: number;
  online?: boolean;
  /** Present when writes should be queued instead of sent. */
  queue?: QueueFn;
  /** Receipt id → other volunteers with it open right now. */
  editors: Editors;
  /** Announces which receipt this device has open. */
  setPresence: (receiptId: string | null) => void;
  /** Rendered as a custom date-range row below the search/sort bar. */
  period: Period;
  onPeriodChange: (period: Period) => void;
  ref?: React.Ref<ReceiptsTableHandle>;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>(DEFAULT_SORT);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // The server sends the first page; further pages append here. A realtime
  // refresh replaces `receipts`, which changes the key and drops the stale
  // tail — derived rather than reset in an effect.
  const pageKey = `${receipts.length}:${receipts[0]?.id ?? ""}`;
  const [tail, setTail] = React.useState<{ key: string; rows: LocalReceipt[] }>({
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
  const [editing, setEditing] = React.useState<LocalReceipt | undefined>();
  const [toDelete, setToDelete] = React.useState<LocalReceipt | undefined>();
  const [deleting, setDeleting] = React.useState(false);
  /** Id of the pledge currently being marked received. */
  const [marking, setMarking] = React.useState<string | null>(null);
  /** Id of the receipt whose share image is currently being generated. */
  const [sending, setSending] = React.useState<string | null>(null);
  /** Pledge waiting for the volunteer to say how it was actually paid. */
  const [toMarkPaid, setToMarkPaid] = React.useState<LocalReceipt | undefined>();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? all
      : all.filter(
          (r) =>
            r.donor_name.toLowerCase().includes(q) ||
            r.phone_number.includes(q) ||
            String(r.receipt_number) === q,
        );
    // Sorts what is loaded. With a paginated tail the top of an amount sort is
    // the largest of the rows fetched so far, not of the whole ledger.
    return sortRows(matched, sort, {
      date: (r) => r.collection_date,
      amount: (r) => r.amount,
      name: (r) => r.donor_name,
    }, locale);
  }, [all, query, sort, locale]);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  React.useImperativeHandle(ref, () => ({ openCreate }));

  function openEdit(receipt: LocalReceipt) {
    // Advisory only — the save is still guarded by the updated_at check. This
    // just means nobody types out an edit that is about to lose a race.
    const others = editors[receipt.id];
    if (others?.length) {
      toast.warning(t("lock.beingEdited", { who: others.join(", ") }));
    }
    setEditing(receipt);
    setDialogOpen(true);
  }

  /**
   * The row being edited may vanish under us — someone else deletes it while
   * the dialog is open. Derived rather than pushed into state, so the dialog
   * closes without an effect writing state during a render pass.
   */
  const editingGone = Boolean(
    dialogOpen &&
      editing &&
      editing.pending !== "create" &&
      online &&
      !all.some((r) => r.id === editing.id),
  );

  // Only the notice needs an effect. The dialog is already closed by the line
  // above, and `editing`/`dialogOpen` are overwritten by every path that opens
  // it again, so there is nothing to reset — and nothing to write from here.
  React.useEffect(() => {
    if (editingGone) toast.error(t("lock.deletedAnon"));
  }, [editingGone, t]);

  // Tell the other volunteers which receipt is open on this device.
  React.useEffect(() => {
    setPresence(dialogOpen && editing && !editingGone ? editing.id : null);
  }, [dialogOpen, editing, editingGone, setPresence]);

  /** Today on the mandal's calendar, for deciding what is overdue. */
  const today = todayInIst();

  const dueTitle = (dueOn: string | null) => {
    if (!dueOn) return t("status.unpaidBadge");
    const date = formatDate(dueOn, locale);
    return dueOn < today
      ? t("status.overdue", { date })
      : t("status.dueOn", { date });
  };

  /**
   * Marks a pledge received from the list, without opening the edit form.
   * How it was actually paid isn't known until now, so the caller supplies it.
   */
  async function markPaid(receipt: LocalReceipt, method: PaymentMethod) {
    if (receipt.pending === "create") {
      toast.error(t("offline.noSend"));
      return;
    }
    setMarking(receipt.id);
    let result;
    try {
      result = await markReceiptPaid(receipt.id, method);
    } catch {
      setMarking(null);
      toast.error(t("error.body"));
      return;
    }
    setMarking(null);

    if (!result.ok) {
      toast.error("error" in result ? result.error : t("toast.conflict"));
      return;
    }
    toast.success(t("status.markedPaid"));
  }

  const shareReceipt = useReceiptShare(mandalName, names);

  function sendWhatsApp(receipt: LocalReceipt) {
    // The message quotes the receipt number, which the server assigns on sync.
    if (receipt.pending === "create") {
      toast.error(t("offline.noSend"));
      return;
    }
    // The message thanks the contributor for money received. Sending it while
    // any of the contribution is still outstanding would be a receipt for cash
    // nobody has handed over — including the half of a part-paid one.
    if (!isFullyPaid(receipt)) {
      toast.error(t("status.cannotSend"));
      return;
    }
    // Image with the receipt text as its caption, falling back to the
    // addressed wa.me message where the share sheet cannot take a file.
    setSending(receipt.id);
    void shareReceipt(receipt).finally(() => setSending(null));
  }

  /** Queues the delete on the device; returns false if it could not be stored. */
  async function queueDelete(receipt: LocalReceipt) {
    if (!queue) return false;
    try {
      await queue({ kind: "delete", receiptId: receipt.id });
      setToDelete(undefined);
      toast.success(t("offline.queued"));
      return true;
    } catch {
      toast.error(t("offline.storageBlocked"));
      return true; // handled
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;

    // Offline, or the row has never reached the server in the first place.
    if ((!online || toDelete.pending === "create") && (await queueDelete(toDelete)))
      return;

    setDeleting(true);
    let result;
    try {
      result = await deleteReceipt(toDelete.id);
    } catch {
      setDeleting(false);
      if (await queueDelete(toDelete)) return;
      toast.error(t("error.body"));
      return;
    }
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
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("table.search")}
            className="pl-8"
          />
        </div>
        <SortFilter value={sort} onChange={setSort} />
      </div>

      <CustomDateRange period={period} onChange={onPeriodChange} />

      {/* Phones get the card list below; the table starts at sm. */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border sm:block">
        <Table className="table-zebra table-sticky">
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
                    {receipt.pending === "create" ? (
                      <span title={t("offline.pending")}>
                        <CloudOff className="size-3.5 text-amber-600" />
                      </span>
                    ) : (
                      receipt.receipt_number
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {receipt.donor_name}
                    {editors[receipt.id]?.length ? (
                      <EditingBadge
                        label={t("lock.badge", {
                          who: editors[receipt.id].join(", "),
                        })}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        // Struck through only when none of it has arrived. A
                        // part-paid contribution has real money against it, so
                        // striking the figure would misrepresent it.
                        receipt.payment_status === "Unpaid" &&
                        !isPartPaid(receipt)
                          ? "text-muted-foreground line-through"
                          : undefined
                      }
                    >
                      {formatAmount(receipt.amount)}
                    </span>
                    {isPartPaid(receipt) ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("status.paidOfTotal", {
                          paid: formatAmount(received(receipt)),
                        })}
                      </span>
                    ) : null}
                    {receipt.payment_status === "Unpaid" ? (
                      <span className="mt-0.5 block">
                        <UnpaidBadge
                          dueOn={receipt.due_on}
                          today={today}
                          label={
                            isPartPaid(receipt)
                              ? t("status.partPaidBadge", {
                                  amount: formatAmount(outstanding(receipt)),
                                })
                              : t("status.unpaidBadge")
                          }
                          title={dueTitle(receipt.due_on)}
                        />
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {receipt.phone_number}
                  </TableCell>
                  <TableCell>
                    {receipt.payment_status === "Paid" ? (
                      <MethodBadge method={receipt.payment_method} label={t(`method.${receipt.payment_method}`)} />
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(receipt.collection_date, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* A receipt thanks someone for money received, so it
                          cannot be sent for a pledge. The title says why the
                          button is dead rather than leaving it a mystery. */}
                      <Button
                        size="sm"
                        disabled={
                          !isFullyPaid(receipt) || sending === receipt.id
                        }
                        onClick={() => sendWhatsApp(receipt)}
                        title={
                          !isFullyPaid(receipt)
                            ? t("status.cannotSend")
                            : t("table.sendTitle", { name: receipt.donor_name })
                        }
                        variant="whatsapp"
                      >
                        {sending === receipt.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MessageCircle />
                        )}
                        {t("table.send")}
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
                          {receipt.payment_status === "Unpaid" ? (
                            <DropdownMenuItem
                              onClick={() => setToMarkPaid(receipt)}
                              disabled={marking === receipt.id}
                            >
                              <Check /> {t("status.markPaid")}
                            </DropdownMenuItem>
                          ) : null}
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
            <li key={receipt.id} className="card-elevated rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere font-medium">
                    {receipt.donor_name}
                  </p>
                  {editors[receipt.id]?.length ? (
                    <EditingBadge
                      label={t("lock.badge", {
                        who: editors[receipt.id].join(", "),
                      })}
                    />
                  ) : null}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 tabular-nums">
                      {receipt.pending === "create" ? (
                        <>
                          <CloudOff className="size-3 text-amber-600" />
                          {t("offline.pending")}
                        </>
                      ) : (
                        `#${receipt.receipt_number}`
                      )}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{receipt.phone_number}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(receipt.collection_date, locale)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      receipt.payment_status === "Unpaid" &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {formatAmount(receipt.amount)}
                  </span>
                  {receipt.payment_status === "Unpaid" ? (
                    <UnpaidBadge
                      dueOn={receipt.due_on}
                      today={today}
                      label={t("status.unpaidBadge")}
                      title={dueTitle(receipt.due_on)}
                    />
                  ) : (
                    <MethodBadge method={receipt.payment_method} label={t(`method.${receipt.payment_method}`)} />
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {receipt.payment_status === "Unpaid" ? (
                  <Button
                    className="flex-1"
                    onClick={() => setToMarkPaid(receipt)}
                    disabled={marking === receipt.id}
                  >
                    {marking === receipt.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    {t("status.markPaid")}
                  </Button>
                ) : (
                  <Button
                    variant="whatsapp"
                    className="flex-1"
                    disabled={sending === receipt.id}
                    onClick={() => sendWhatsApp(receipt)}
                  >
                    {sending === receipt.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <MessageCircle />
                    )}
                    {t("table.send")}
                  </Button>
                )}
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
        open={dialogOpen && !editingGone}
        onOpenChange={setDialogOpen}
        receipt={editing}
        online={online}
        queue={queue}
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

      <AlertDialog
        open={Boolean(toMarkPaid)}
        onOpenChange={(open) => {
          if (!open) setToMarkPaid(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("status.chooseMethod")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("status.chooseMethodBody", {
                name: toMarkPaid?.donor_name ?? "",
                amount: toMarkPaid ? formatAmount(toMarkPaid.amount) : "",
              })}
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
                {marking === toMarkPaid?.id ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t(`method.${m}`)}
              </Button>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
