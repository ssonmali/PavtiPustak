"use client";

import * as React from "react";
import { ImageDown, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";
import { drawReceiptImage, type ReceiptImageData } from "@/lib/receipt-image";
import { Button } from "@/components/ui/button";

let fileShareSupport: boolean | null = null;

function supportsFileShare() {
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
 * Turns the receipt into a PNG and hands it to the phone's share sheet, which
 * can attach it straight to a WhatsApp chat.
 *
 * An image rather than the PDF because of how WhatsApp shows them: a PDF
 * arrives as a file with a generic icon, while an image previews in the chat —
 * the contributor sees the receipt without opening anything.
 */
export function ShareReceipt({
  data,
  backgroundUrl,
  fileName,
}: {
  data: ReceiptImageData;
  backgroundUrl: string | null;
  fileName: string;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = React.useState(false);
  /**
   * Whether this browser can share a file. Read after mount: `navigator` does
   * not exist during SSR, and guessing would change the button's label on
   * hydration. Answered once and cached — getSnapshot runs on every render, and
   * it has to return the same value each time anyway.
   */
  const canShareFiles = React.useSyncExternalStore(
    () => () => {},
    supportsFileShare,
    () => false,
  );

  async function run() {
    setBusy(true);
    try {
      const blob = await drawReceiptImage(data, backgroundUrl);
      const file = new File([blob], fileName, { type: "image/png" });

      if (canShareFiles && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: data.title });
        } catch (error) {
          // Dismissing the share sheet rejects with AbortError; that is a
          // choice, not a failure, so it gets no error toast.
          if ((error as Error)?.name !== "AbortError") throw error;
        }
        return;
      }

      // No share sheet: save it, and the volunteer attaches it themselves.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("share.saved"));
    } catch {
      toast.error(t("share.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="whatsapp"
      onClick={() => void run()}
      disabled={busy}
      className="print:hidden"
    >
      {busy ? (
        <Loader2 className="animate-spin" />
      ) : canShareFiles ? (
        <Share2 />
      ) : (
        <ImageDown />
      )}
      {canShareFiles ? t("share.share") : t("share.download")}
    </Button>
  );
}
