"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Shortest time the Welcome Back screen stays up, so it never just flashes. */
const MIN_VISIBLE_MS = 1500;

/**
 * Preloads the dashboard as soon as the welcome screen mounts, then moves on.
 * Next's router exposes no "prefetch finished" signal, so the minimum is the
 * hand-off point; `replace` keeps Back from returning to this screen.
 */
export function WelcomeContinue({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
    const timer = window.setTimeout(() => router.replace(href), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [router, href]);

  return null;
}
