import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline · SGMM Pustak" };

/**
 * Cached by the service worker at install time and served when a page is
 * requested that has never been visited online. Deliberately static and
 * bilingual: it must render with no data and no locale cookie.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <CloudOff className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">ऑफलाइन</p>
          <p className="text-sm text-muted-foreground">
            हे पान अजून जतन केलेले नाही. जोडणी परत आल्यावर पुन्हा प्रयत्न करा.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You are offline and this page has not been saved yet. Pages you have
            already opened still work, and receipts you enter will sync when the
            connection returns.
          </p>
        </div>
      </div>
    </main>
  );
}
