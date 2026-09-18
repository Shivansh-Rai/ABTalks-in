"use client";

import { useEffect } from "react";

/** Shortest time the Welcome Back screen stays up, so it never just flashes. */
const MIN_VISIBLE_MS = 1500;

/**
 * Holds this document on screen, then does a full navigation to the dashboard.
 *
 * Client `router.replace` is the wrong tool here: `/dashboard` is dynamic and
 * has no `loading.tsx`, so Next skips prefetch and the soft navigation either
 * sits on a blank shell or swaps away from this loader while the hub still
 * takes several seconds to render. `location.replace` keeps this paint up
 * until the dashboard HTML arrives, and Back cannot return here.
 */
export function WelcomeContinue({ href }: { href: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(href);
    }, MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [href]);

  return null;
}
