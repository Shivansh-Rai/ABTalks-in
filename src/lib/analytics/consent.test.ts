/**
 * Consent Mode v2 mapping contract — run with:
 *   npm run test:analytics-consent
 * or:
 *   npx tsx src/lib/analytics/consent.test.ts
 *
 * Matches docs/plans/115-t252-ga4-consent-loader.md §5 verbatim.
 */
import { toGaConsent, type GaConsentSignals } from "@/lib/analytics/consent";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log("  ✓", name);
}

function equal(a: GaConsentSignals, b: GaConsentSignals): boolean {
  return (
    a.ad_storage === b.ad_storage &&
    a.analytics_storage === b.analytics_storage &&
    a.ad_user_data === b.ad_user_data &&
    a.ad_personalization === b.ad_personalization
  );
}

const ALL_DENIED: GaConsentSignals = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const LIMITED: GaConsentSignals = {
  ad_storage: "denied",
  analytics_storage: "granted",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const ALL_GRANTED: GaConsentSignals = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

console.log("analytics/consent tests");

{
  assert(equal(toGaConsent(null), ALL_DENIED), "null must map to all-denied");
  ok("null → all denied (Consent Mode default state)");
}

{
  assert(
    equal(toGaConsent("essential"), ALL_DENIED),
    "essential must map to all-denied",
  );
  ok("essential → all denied (same as null)");
}

{
  const got = toGaConsent("limited");
  assert(
    got.analytics_storage === "granted",
    "limited must grant analytics_storage",
  );
  assert(got.ad_storage === "denied", "limited must deny ad_storage");
  assert(got.ad_user_data === "denied", "limited must deny ad_user_data");
  assert(
    got.ad_personalization === "denied",
    "limited must deny ad_personalization",
  );
  assert(equal(got, LIMITED), "limited must match target signals exactly");
  ok("limited → analytics only (target state under Consent Mode v2)");
}

{
  assert(equal(toGaConsent("all"), ALL_GRANTED), "all must grant every signal");
  ok("all → every signal granted");
}

console.log(`\n${passed} assertions passed`);
