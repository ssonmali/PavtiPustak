"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintBar({
  printLabel,
  backLabel,
}: {
  printLabel: string;
  backLabel: string;
}) {
  return (
    // print:hidden keeps the toolbar out of the PDF itself.
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" render={<Link href="/dashboard/receipts" />}>
        <ArrowLeft /> {backLabel}
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer /> {printLabel}
      </Button>
    </div>
  );
}
