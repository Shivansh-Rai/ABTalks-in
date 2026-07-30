import { CertificateType, Domain } from "@prisma/client";

/**
 * Crockford-style alphabet: no 0/O/1/I/L. 31^5 ≈ 28.6M ids per track —
 * plenty for a 1,500-student platform, and unambiguous when read off a printed page.
 */
export const CERT_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CERT_ID_LENGTH = 5;
export const CERT_ID_PATTERN = /^ABT-[A-Z]{2}-[23456789A-HJ-NP-Z]{5}$/;

type CertificateTypeConfig = {
  /** The XX segment of ABT-XX-XXXXX. */
  code: string;
  title: string;
  subtitle: string;
};

export const CERTIFICATE_TYPES: Record<CertificateType, CertificateTypeConfig> = {
  CLAUDE_CHALLENGE: {
    code: "CC",
    title: "60-Day Claude Challenge",
    subtitle: "Claude AI Mastery Track",
  },
  HACKATHON: { code: "HK", title: "ABTalks Hackathon", subtitle: "Hackathon" },
  COHORT: { code: "CH", title: "ABTalks Cohort", subtitle: "Cohort Program" },
  WORKSHOP: { code: "WS", title: "ABTalks Workshop", subtitle: "Workshop" },
};

/**
 * Overlay layout, expressed as FRACTIONS of the template page box.
 *
 * Derived by measuring the approved template artwork (landscape, orange/near-black
 * "CERTIFICATE OF COMPLETION" design). Ratios rather than absolute points because the
 * artwork's aspect ratio (~1.57) is NOT A4 landscape (1.415) or Letter landscape
 * (1.294) — it is a custom page box, so hard-coded points would be wrong.
 *
 * The template has FIVE stamp targets, not three:
 *   1. CERTIFICATE ID value  — under the top-right "CERTIFICATE ID" label (left of badge)
 *   2. ISSUED ON value       — under the bottom-right "ISSUED ON" label
 *   3. Recipient name        — between "PROUDLY PRESENTED TO" and the orange rule
 *   4. QR code               — under the bottom-right "SCAN TO VERIFY" label
 *   5. Verify URL            — under the bottom-right "Verify authenticity at" label
 *
 * Note the artwork's content column is centred at ~0.512, not 0.5 — the decorative
 * "AI" head graphic on the left pushes the text block slightly right. Centring the
 * name on 0.5 makes it visibly misaligned against "CERTIFICATE" above it.
 *
 * !!! These are STARTING values measured off the artwork render. Confirm against the
 * real PDF's MediaBox with the debug grid (see Step 9a) before shipping. !!!
 * Origin is bottom-left (pdf-lib convention), y grows upward.
 */
export const CLAUDE_CERT_LAYOUT = {
  /** Shared centre of the artwork's content column. */
  contentCenterXRatio: 0.512,

  issuedOn: {
    /** Bottom-right, centred under the "ISSUED ON" label. */
    centerXRatio: 0.85,
    baselineYRatio: 0.085,
    fontSize: 10,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  certificateId: {
    /** Top-right, centred under "CERTIFICATE ID" (left of the Verified badge). */
    centerXRatio: 0.78,
    baselineYRatio: 0.88,
    fontSize: 10,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  name: {
    /** Matches the content column, NOT the page centre. */
    centerXRatio: 0.512,
    /** Sits in the gap between "PROUDLY PRESENTED TO" and the orange rule. */
    baselineYRatio: 0.59,
    /** Locked by product owner. Auto-shrinks only if a name would overflow. */
    fontSize: 30,
    minFontSize: 16,
    /** Must not run past the orange rule (which spans ~0.30–0.72 of page width). */
    maxWidthRatio: 0.55,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  qr: {
    /** Bottom-left corner of the QR square, centred under "SCAN TO VERIFY". */
    xRatio: 0.873,
    yRatio: 0.082,
    sizeRatio: 0.082,
  },
  verifyText: {
    /** LEFT-aligned under "Verify authenticity at" — this label is bottom-right in the
     *  artwork, not bottom-centre. Do not centre this on the page. */
    xRatio: 0.855,
    baselineYRatio: 0.033,
    fontSize: 7,
    color: { r: 0.42, g: 0.45, b: 0.5 },
  },
} as const;

export function certificateDomainLabel(domain: Domain | null): string {
  switch (domain) {
    case Domain.CLAUDE: return "Claude AI Mastery";
    case Domain.SE: return "Software Engineering";
    case Domain.DS: return "Data Science";
    case Domain.AI: return "Artificial Intelligence";
    default: return "—";
  }
}
