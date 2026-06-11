"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "default" }), "print:hidden")}
    >
      <Download className="mr-2 size-4" /> Download PDF
    </button>
  );
}
