/**
 * Maps ABTalks cookie choices onto Google Consent Mode v2 signals.
 *
 * Plain module — no `"server-only"`, no `next/headers` — so client callers
 * (the GA4 loader) and server callers (T-253 emit sites) can share one
 * source of truth. Table matches docs/plans/115-t252-ga4-consent-loader.md §5.
 */
import type { CookieChoice } from "@/lib/cookies";

export type GaConsentSignal = "granted" | "denied";

export type GaConsentSignals = {
  ad_storage: GaConsentSignal;
  analytics_storage: GaConsentSignal;
  ad_user_data: GaConsentSignal;
  ad_personalization: GaConsentSignal;
};

const ALL_DENIED: GaConsentSignals = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

export function toGaConsent(choice: CookieChoice | null): GaConsentSignals {
  if (choice === "all") {
    return {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    };
  }
  if (choice === "limited") {
    return {
      ad_storage: "denied",
      analytics_storage: "granted",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };
  }
  return ALL_DENIED;
}
