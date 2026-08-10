/**
 * Client-safe legal constants.
 *
 * Kept separate from `legal.ts` because that module reads from disk
 * (`node:fs/promises`) — importing it from a Client Component pulls a Node
 * built-in into the browser bundle and fails the build. Anything a client
 * needs lives here; `legal.ts` re-exports it so server callers are unaffected.
 */

/** Bump these when `content/legal/*.md` versions change; consent rows store them. */
export const TERMS_VERSION = "2026-08-10";
export const PRIVACY_VERSION = "2026-08-10";

/** Bumping this invalidates every stored cookie choice and re-prompts. */
export const COOKIE_POLICY_VERSION = "2026-08-10";

export type LegalDocKind = "terms" | "privacy" | "cookies";

/**
 * Single source of truth for entity identification.
 *
 * `content/legal/terms.md` and `content/legal/privacy.md` repeat these values
 * literally because markdown cannot import — update all three together.
 *
 * The `<<FILL: …>>` markers are intentional. They must be replaced with the
 * real registered details before this ships to production; they are required
 * under India's DPDP Act 2023, the IT Rules 2021, and the Consumer Protection
 * (E-Commerce) Rules 2020. Do not invent values.
 */
export const LEGAL_ENTITY = {
  name: "<<FILL: registered entity legal name>>",
  tradingName: "ABTalks",
  address: "<<FILL: registered address>>",
  registrationNumber: "<<FILL: CIN / LLPIN / GSTIN, or 'Not applicable'>>",
  email: "team@abtalks.in",
  grievanceOfficer: {
    name: "<<FILL: grievance officer name>>",
    designation: "<<FILL: designation>>",
    email: "team@abtalks.in",
    acknowledgeWithin: "24 hours",
    resolveWithin: "15 days",
  },
} as const;
