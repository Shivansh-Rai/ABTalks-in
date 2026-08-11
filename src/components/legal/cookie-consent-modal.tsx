"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCookieConsent,
  type CookieChoice,
} from "@/components/legal/cookie-consent-provider";

/**
 * Bottom-left cookie banner sized like common SaaS patterns (e.g. CodeSignal):
 * ~22rem wide card, short copy, two outline actions + full-width Accept all.
 *
 * Not a dialog: no overlay, no focus trap, page stays usable. Ignoring it
 * means no attribution cookies until a choice is made (middleware already
 * gates on consent).
 */
export function CookieConsentModal() {
  const { isOpen, choice, decide, close } = useCookieConsent();
  const [pending, setPending] = useState<CookieChoice | null>(null);

  // Only closable once a choice exists — i.e. when reopened from /cookies.
  const dismissible = choice !== null;

  useEffect(() => {
    if (!isOpen || !dismissible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, dismissible, close]);

  if (!isOpen) return null;

  async function onChoose(next: CookieChoice) {
    setPending(next);
    try {
      await decide(next);
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      className={cn(
        // CodeSignal-style: bottom-left, fixed ~22rem card (not full-width strip).
        "fixed z-100 w-[min(calc(100%-2rem),22rem)]",
        "left-4 right-auto",
        // Clear mobile bottom nav; sit in the corner on desktop.
        "bottom-20 md:bottom-6",
        "overflow-hidden rounded-xl border border-border/80 bg-background shadow-2xl",
      )}
    >
      {/* Accent bar — matches reference blue strip on the card edge */}
      <div className="h-1.5 w-full bg-primary" aria-hidden="true" />

      <div className="p-5">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
            This website uses cookies for essential sign-in, and optional ones
            for referrals and share attribution. By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            .{" "}
            <Link
              href="/cookies"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Cookie details
            </Link>
            .
          </p>
          {dismissible && (
            <button
              type="button"
              onClick={close}
              aria-label="Close cookie choices"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Two equal outline buttons, then full-width primary — reference layout */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("limited")}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md border border-border",
              "bg-background px-3 text-xs font-semibold tracking-wide uppercase",
              "text-foreground transition-colors hover:bg-muted",
              "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              choice === "limited" && "ring-1 ring-primary/50",
            )}
          >
            {pending === "limited" ? "…" : "Limited"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("essential")}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md border border-border",
              "bg-background px-3 text-xs font-semibold tracking-wide uppercase",
              "text-foreground transition-colors hover:bg-muted",
              "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              choice === "essential" && "ring-1 ring-primary/50",
            )}
          >
            {pending === "essential" ? "…" : "Reject all"}
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("all")}
          className={cn(
            "mt-2 flex h-11 w-full items-center justify-center rounded-md",
            "bg-primary px-3 text-sm font-semibold tracking-wide uppercase",
            "text-primary-foreground transition-colors hover:bg-primary/90",
            "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            choice === "all" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
          )}
        >
          {pending === "all" ? "…" : "Accept all"}
        </button>
      </div>
    </div>
  );
}
