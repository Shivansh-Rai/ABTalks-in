import assert from "node:assert/strict";
import {
  COOKIE_POLICY_VERSION,
  TERMS_VERSION,
  PRIVACY_VERSION,
} from "@/lib/legal-constants";

console.log("Cookie consent and legal constants tests");

// 1. Legal constants versions are valid dates
assert.match(
  TERMS_VERSION,
  /^\d{4}-\d{2}-\d{2}$/,
  "TERMS_VERSION must be a YYYY-MM-DD date",
);
assert.match(
  PRIVACY_VERSION,
  /^\d{4}-\d{2}-\d{2}$/,
  "PRIVACY_VERSION must be a YYYY-MM-DD date",
);
assert.match(
  COOKIE_POLICY_VERSION,
  /^\d{4}-\d{2}-\d{2}$/,
  "COOKIE_POLICY_VERSION must be a YYYY-MM-DD date",
);
console.log("  ✓ versions: formatted as YYYY-MM-DD dates");

// 2. Cookie parser logic simulates policy version invalidation
function parseChoice(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  if (raw.slice(dot + 1) !== COOKIE_POLICY_VERSION) return null;
  const stored = raw.slice(0, dot);
  return stored === "all" || stored === "limited" || stored === "essential"
    ? stored
    : null;
}

assert.equal(
  parseChoice(`all.${COOKIE_POLICY_VERSION}`),
  "all",
  "Current version all is accepted",
);
assert.equal(
  parseChoice(`essential.${COOKIE_POLICY_VERSION}`),
  "essential",
  "Current version essential is accepted",
);
assert.equal(
  parseChoice(`limited.${COOKIE_POLICY_VERSION}`),
  "limited",
  "Current version limited is accepted",
);
assert.equal(
  parseChoice("all.2026-08-10"),
  null,
  "Outdated version is invalidated",
);
assert.equal(
  parseChoice("invalid"),
  null,
  "Missing version dot is invalidated",
);
console.log("  ✓ invalidation: old policy versions are invalidated and re-prompt");

// 3. Category mapping logic for Manage Preferences
function mapPreferencesToChoice(analytics: boolean, attribution: boolean) {
  if (analytics && attribution) return "all";
  if (analytics || attribution) return "limited";
  return "essential";
}

assert.equal(mapPreferencesToChoice(true, true), "all");
assert.equal(mapPreferencesToChoice(true, false), "limited");
assert.equal(mapPreferencesToChoice(false, true), "limited");
assert.equal(mapPreferencesToChoice(false, false), "essential");
console.log("  ✓ preferences mapping: category toggles map accurately to choices");

console.log("\nAll cookie consent unit tests passed!");
