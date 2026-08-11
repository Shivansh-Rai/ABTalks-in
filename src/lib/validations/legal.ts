import { z } from "zod";

const mustAccept = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

/**
 * Shared legal acceptance for all signup funnels.
 * One checkbox covers Terms + Privacy; age is stated in the Terms (18+).
 * Newsletter is separate and never blocks signup.
 */
export const legalAcceptanceSchema = z.object({
  acceptLegal: mustAccept(
    "Please accept the Terms of Service and Privacy Policy",
  ),
  /**
   * Marketing opt-in. A plain boolean, NOT a `mustAccept` — declining must
   * never fail validation or block signup.
   *
   * Required rather than `.optional()` or `.default()`: either of those makes
   * the schema's input type diverge from its output type, which breaks
   * react-hook-form's resolver generics in the register and hackathon forms.
   * Every funnel sends the value explicitly.
   */
  newsletterOptIn: z.boolean(),
});

export type LegalAcceptanceInput = z.infer<typeof legalAcceptanceSchema>;

export const dataRightsRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  type: z.enum(["ACCESS", "CORRECTION", "ERASURE", "OTHER"]),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("")),
});

export type DataRightsRequestInput = z.infer<typeof dataRightsRequestSchema>;

/**
 * Cookie chooser submission. `ref` / `src` are the attribution values read from
 * the current URL at the moment the user decides — middleware no longer sets
 * them pre-consent, so they must round-trip through this action.
 */
export const cookieConsentSchema = z.object({
  choice: z.enum(["all", "limited", "essential"]),
  ref: z.string().trim().max(32).nullable().optional(),
  src: z.string().trim().max(32).nullable().optional(),
});

export type CookieConsentInput = z.infer<typeof cookieConsentSchema>;

/** Admin action closing out a data-rights request. */
export const resolveDataRightsRequestSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "DONE", "REJECTED"]),
});

export type ResolveDataRightsRequestInput = z.infer<
  typeof resolveDataRightsRequestSchema
>;
