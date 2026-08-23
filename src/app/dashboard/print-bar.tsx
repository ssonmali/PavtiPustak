"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Back + print, for pages whose whole body is the printable thing. */
export function PrintBar({
  printLabel,
  backLabel,
  backHref = "/dashboard/receipts",
}: {
  printLabel: string;
  backLabel: string;
  backHref?: string;
}) {
  return (
    // print:hidden keeps the toolbar out of the PDF itself.
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" render={<Link href={backHref} />}>
        <ArrowLeft /> {backLabel}
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer /> {printLabel}
      </Button>
    </div>
  );
}
