"use client";

import * as React from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  React.useEffect(() => {
    // Surfaces in the Vercel function logs with the digest shown to the user.
    console.error("dashboard error", error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert className="size-5 text-destructive" />
        </div>
        <div>
          <p className="font-medium">{t("error.title")}</p>
          <p className="text-sm text-muted-foreground">{t("error.body")}</p>
        </div>
        <Button onClick={reset}>
          <RotateCw /> {t("error.retry")}
        </Button>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
