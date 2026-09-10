/**
 * Pure gate + downgrade-detection helpers for GA4Loader.
 *
 * Split out of ga4-loader.tsx (which is "use client" and imports the consent
 * provider, dragging a server-only chain when run under tsx) so the tests
 * can exercise every branch without spinning up React. No React, no
 * "use client", no next/headers — safe to import from anywhere.
 */
import { toGaConsent, type GaConsentSignals } from "@/lib/analytics/consent";
import type { CookieChoice } from "@/lib/cookies";

export type Ga4RenderState =
  | { render: "null" }
  | { render: "scripts"; measurementId: string; defaults: GaConsentSignals };

export type ComputeGa4StateArgs = {
  ready: boolean;
  choice: CookieChoice | null;
  isProd: boolean;
  measurementId: string | undefined;
};

/**
 * Strict interpretation of plan 115 §11: GA4 mounts only when the user has
 * affirmatively granted analytics_storage (choice ∈ {limited, all}). Under
 * essential or an undecided choice, we render nothing — no gtag.js request,
 * no cookieless pings, no requests to any Google endpoint.
 */
export function computeGa4State(args: ComputeGa4StateArgs): Ga4RenderState {
  if (!args.ready) return { render: "null" };
  if (!args.isProd) return { render: "null" };
  if (!args.measurementId) return { render: "null" };
  if (args.choice !== "limited" && args.choice !== "all") {
    return { render: "null" };
  }
  return {
    render: "scripts",
    measurementId: args.measurementId,
    defaults: toGaConsent(args.choice),
  };
}

/**
 * A "downgrade" is any transition from a loaded state (limited or all) to a
 * non-loaded state (essential or null). Undefined prev — the first observation
 * on mount — is never a downgrade. Lateral limited↔all changes are not
 * downgrades either: the scripts stay mounted; a Consent Mode 'update' would
 * technically refine the signals but is out of scope for T-252.
 */
export function shouldReloadOnDowngrade(
  prev: CookieChoice | null | undefined,
  next: CookieChoice | null,
): boolean {
  if (prev === undefined) return false;
  if (prev === next) return false;
  const wasLoaded = prev === "limited" || prev === "all";
  const isNowLoaded = next === "limited" || next === "all";
  return wasLoaded && !isNowLoaded;
}
