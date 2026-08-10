"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCookieConsent,
  type CookieChoice,
} from "@/components/legal/cookie-consent-provider";

const OPTIONS: {
  choice: CookieChoice;
  label: string;
  description: string;
  emphasis: boolean;
}[] = [
  {
    choice: "all",
    label: "Allow all",
    description:
      "Sign-in cookies, referral and share attribution, and video thumbnails loaded from YouTube.",
    emphasis: true,
  },
  {
    choice: "limited",
    label: "Limited",
    description:
      "Sign-in and attribution cookies only. Nothing is requested from YouTube until you press play.",
    emphasis: false,
  },
  {
    choice: "essential",
    label: "Deny",
    description:
      "Sign-in cookies only. No attribution cookies are set, and any we already set are removed.",
    emphasis: false,
  },
];

export function CookieConsentModal() {
  const { isOpen, choice, decide } = useCookieConsent();
  const [pending, setPending] = useState<CookieChoice | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Reopened from /cookies after a prior decision — dismissible.
  const dismissible = choice !== null;

  useEffect(() => {
    if (!isOpen) return;

    firstButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Trap focus. Esc only closes when a choice already exists — an undecided
    // visitor must not be able to dismiss their way past the chooser.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      // No outside-click dismiss: closing without choosing would leave the
      // visitor in an undecided state while the page keeps running.
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Cookie className="size-4.5" aria-hidden="true" />
            </span>
            <h2
              id="cookie-consent-title"
              className="font-display text-lg font-semibold text-foreground"
            >
              Your cookie choice
            </h2>
          </div>
          <p
            id="cookie-consent-description"
            className="mt-3 text-sm leading-relaxed text-muted-foreground"
          >
            We use cookies to keep you signed in. We&apos;d also like to set
            optional cookies to credit referrals and see which share link
            brought you here. You choose — and you can change it any time.
          </p>
        </div>

        <div className="mt-5 space-y-2 px-6">
          {OPTIONS.map((option, index) => (
            <button
              key={option.choice}
              ref={index === 0 ? firstButtonRef : undefined}
              type="button"
              disabled={pending !== null}
              onClick={() => onChoose(option.choice)}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "disabled:cursor-not-allowed disabled:opacity-60",
                option.emphasis
                  ? "border-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border hover:bg-muted/60",
                choice === option.choice && "ring-1 ring-primary/40",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {option.label}
                </span>
                {choice === option.choice && (
                  <span className="text-[11px] font-medium text-primary">
                    Current
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 bg-muted/30 px-6 py-4 text-xs text-muted-foreground">
          <Link
            href="/cookies"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Cookie Policy
          </Link>
          <Link
            href="/privacy"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          <span className="ml-auto">
            {dismissible
              ? "Your current choice stays until you pick another."
              : "Strictly necessary cookies are always on."}
          </span>
        </div>
      </div>
    </div>
  );
}
