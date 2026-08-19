"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCookieConsent } from "@/components/legal/cookie-consent-provider";

const LABELS: Record<string, string> = {
  all: "Allow all",
  limited: "Limited",
  essential: "Deny",
};

export function ManageCookiesButton() {
  const { open, choice, ready } = useCookieConsent();

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-4">
      <button
        type="button"
        onClick={open}
        className={cn(buttonVariants({ size: "sm" }))}
      >
        Manage cookie preferences
      </button>
      <span className="text-xs text-muted-foreground">
        {!ready
          ? "Loading your current choice…"
          : choice
            ? `Current choice: ${LABELS[choice] ?? choice}`
            : "You haven’t made a choice yet."}
      </span>
    </div>
  );
}
