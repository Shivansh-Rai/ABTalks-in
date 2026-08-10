"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCookieConsent,
  type CookieChoice,
} from "@/components/legal/cookie-consent-provider";

const OPTIONS: { choice: CookieChoice; label: string; primary: boolean }[] = [
  { choice: "all", label: "Allow all", primary: true },
  { choice: "limited", label: "Limited", primary: false },
  { choice: "essential", label: "Deny", primary: false },
];

/**
 * Compact bottom-corner cookie chooser.
 *
 * Deliberately NOT a dialog: it does not block the page, trap focus, or lock
 * scrolling, so `role="region"` is correct and `aria-modal` would be a lie.
 * Ignoring it is allowed — middleware sets no attribution cookies until a
 * choice exists, so silence is treated as "not yet decided", never as consent.
 */
export function CookieConsentModal() {
  const { isOpen, choice, decide, close } = useCookieConsent();
  const [pending, setPending] = useState<CookieChoice | null>(null);

  // Only closable once a choice exists — i.e. when reopened from /cookies.
  // While undecided there is nothing to fall back to, so no close affordance.
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

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      className={cn(
        "fixed right-4 left-4 z-100 sm:left-auto sm:w-full sm:max-w-sm",
        // Clear the mobile bottom nav; sit close to the corner on desktop.
        "bottom-20 md:bottom-4",
        "rounded-xl border border-border bg-background p-4 shadow-2xl",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cookie className="size-3.5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-sm font-semibold text-foreground">
          Cookies
        </h2>
        {dismissible && (
          <button
            type="button"
            onClick={close}
            aria-label="Close cookie choices"
            className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        We use cookies to keep you signed in. Optional ones let us credit
        referrals and see which link brought you here.{" "}
        <Link
          href="/cookies"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Details
        </Link>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.choice}
            type="button"
            disabled={pending !== null}
            onClick={() => onChoose(option.choice)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              option.primary
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border text-foreground hover:bg-muted",
              choice === option.choice && "ring-1 ring-primary/50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
