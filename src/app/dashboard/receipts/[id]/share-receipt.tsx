"use client";

import * as React from "react";
import { Loader2, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useReceiptShare } from "@/lib/use-receipt-share";
import type { NameMap, Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";

/**
 * Sends the receipt as an image, with the written receipt as the caption.
 *
 * An image rather than the PDF because of how WhatsApp shows them: a PDF
 * arrives as a file with a generic icon, while an image previews in the chat —
 * the contributor sees the receipt without opening anything.
 */
export function ShareReceipt({
  receipt,
  mandalName,
  names,
}: {
  receipt: Receipt;
  mandalName: string;
  names: NameMap;
}) {
  const { t } = useI18n();
  const share = useReceiptShare(mandalName, names);
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="whatsapp"
      disabled={busy}
      className="print:hidden"
      onClick={async () => {
        setBusy(true);
        try {
          await share(receipt);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Share2 />}
      {t("share.share")}
    </Button>
  );
}
