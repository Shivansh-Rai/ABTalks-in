"use client";

import { useCallback } from "react";
import { useCookieConsent } from "@/components/legal/cookie-consent-provider";
import {
  hasAnalyticsConsent,
  sanitizeParams,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from "@/lib/analytics/events";

/**
 * The only way ABTalks sends a GA4 event.
 *
 * Rides on whatever T-252 already put on the page: the `window.gtag` the
 * GA4Loader defines, and the consent choice from the same
 * `useCookieConsent()` the loader reads. It never loads a script, never
 * configures a measurement id, and never queues anything for later.
 *
 * Three independent things must all be true before an event leaves:
 *
 * 1. the consent cookie has been read (`ready`),
 * 2. the choice grants `analytics_storage` (plan 114 §6 — checked here at the
 *    emit site, not only at the loader),
 * 3. `window.gtag` exists — which under T-252's strict gate is true only in
 *    production, with a measurement id configured, after consent was granted.
 *
 * Outside production, or before consent, `track()` is a silent no-op.
 *
 * Call it from the branch that already knows the action succeeded — the
 * `result.ok` arm of a Server Action call — so an event means the thing
 * happened, not that somebody clicked.
 */
export function useTrack() {
  const { choice, ready } = useCookieConsent();

  return useCallback(
    <K extends AnalyticsEventName>(
      name: K,
      params?: AnalyticsEventParams[K],
    ): void => {
      if (!ready) return;
      if (!hasAnalyticsConsent(choice)) return;

      const gtag = typeof window === "undefined" ? undefined : window.gtag;
      if (typeof gtag !== "function") return;

      const safe = sanitizeParams(name, params);
      // An event with nothing to say sends nothing rather than an empty object,
      // which GA4 would otherwise record as a parameter-less payload anyway.
      if (Object.keys(safe).length === 0) {
        gtag("event", name);
        return;
      }
      gtag("event", name, safe);
    },
    [choice, ready],
  );
}
