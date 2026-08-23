"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";
import { dictionaries, interpolate, type MessageKey } from "@/lib/i18n/dictionaries";
import {
  displayName,
  formatAmountMarathi,
  formatDate,
  whatsappUrl,
} from "@/lib/receipt-utils";
import { drawReceiptImage, type ReceiptImageData } from "@/lib/receipt-image";
import type { NameMap, Receipt } from "@/lib/types";

/**
 * The shared image is handed to whoever the contributor forwards it to, not
 * just the volunteer who sent it — it reads in Marathi regardless of which
 * language the sender has the app set to. Names are never run through this:
 * they're proper nouns, not UI text.
 */
function tMarathi(key: MessageKey, values?: Record<string, string | number>) {
  return interpolate(dictionaries.mr[key], values);
}

/** NEXT_PUBLIC_* are inlined at build time, so the client can read them. */
const WATERMARK = process.env.NEXT_PUBLIC_RECEIPT_WATERMARK ?? null;
const ADDRESS = process.env.NEXT_PUBLIC_MANDAL_ADDRESS ?? null;
const PRESIDENT = process.env.NEXT_PUBLIC_MANDAL_PRESIDENT ?? null;
const VICE_PRESIDENT = process.env.NEXT_PUBLIC_MANDAL_VICE_PRESIDENT ?? null;

let fileShareSupport: boolean | null = null;

/** Whether this browser can put a file into the OS share sheet. */
export function supportsFileShare() {
  if (fileShareSupport !== null) return fileShareSupport;
  try {
    fileShareSupport =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([""], "probe.png", { type: "image/png" })],
      });
  } catch {
    // Older browsers throw on the File constructor rather than returning false.
    fileShareSupport = false;
  }
  return fileShareSupport;
}

/**
 * Sends a receipt as an image, with the written receipt carried along as the
 * share caption.
 *
 * The two routes are not interchangeable, which is why the fallback matters:
 * `navigator.share` can attach the image but cannot address anyone — the
 * volunteer picks the chat — while a `wa.me` link opens the contributor's own
 * chat by number but can never carry a file. Where the share sheet is missing,
 * the addressed text message is a better outcome than a saved file nobody sends.
 */
export function useReceiptShare(mandalName: string, names: NameMap) {
  const { t } = useI18n();

  return React.useCallback(
    async (receipt: Receipt) => {
      // Copied up front, before anything that can fail below: if the share
      // sheet opens the wrong chat, the volunteer can paste the right number
      // in themselves rather than hunting for it back in the app.
      try {
        await navigator.clipboard.writeText(receipt.phone_number);
      } catch {
        // Clipboard access can be denied or unavailable; not worth blocking
        // the send over.
      }

      const collectedBy = receipt.created_by_email
        ? displayName(receipt.created_by_email, names)
        : null;

      const caption = whatsappUrl(receipt, mandalName);
      const captionText = decodeURIComponent(caption.split("?text=")[1] ?? "");

      // No share sheet: the addressed message still reaches the right person.
      if (!supportsFileShare()) {
        window.open(caption, "_blank", "noopener");
        return;
      }

      const data: ReceiptImageData = {
        mandalName,
        address: ADDRESS,
        title: tMarathi("slip.title"),
        donorLabel: tMarathi("slip.received"),
        donorName: receipt.donor_name,
        amountLabel: tMarathi("slip.amount"),
        amount: formatAmountMarathi(receipt.amount),
        rows: [
          { label: tMarathi("slip.number"), value: String(receipt.receipt_number) },
          {
            label: tMarathi("slip.date"),
            value: formatDate(receipt.collection_date, "mr"),
          },
          {
            label: tMarathi("slip.method"),
            value: tMarathi(`method.${receipt.payment_method}`),
          },
        ],
        thanks: tMarathi("slip.thanks"),
        footer: collectedBy
          ? `${tMarathi("slip.collectedBy")}: ${collectedBy}`
          : null,
        president: PRESIDENT,
        vicePresident: VICE_PRESIDENT,
      };

      try {
        const blob = await drawReceiptImage(data, WATERMARK);
        const file = new File([blob], `pavti-${receipt.receipt_number}.png`, {
          type: "image/png",
        });

        if (!navigator.canShare({ files: [file] })) {
          window.open(caption, "_blank", "noopener");
          return;
        }

        await navigator.share({ files: [file], text: captionText });
      } catch (error) {
        // Dismissing the sheet rejects with AbortError. That is a choice, not a
        // failure, so it gets no complaint.
        if ((error as Error)?.name === "AbortError") return;
        toast.error(t("share.failed"));
      }
    },
    [mandalName, names, t],
  );
}
