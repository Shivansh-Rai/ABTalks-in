import { z } from "zod";

const mustAccept = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

/** Shared Terms + Privacy + age attestation for all signup funnels. */
export const legalAcceptanceSchema = z.object({
  acceptTerms: mustAccept("Please accept the Terms of Service"),
  acceptPrivacy: mustAccept("Please accept the Privacy Policy"),
  confirmAge18: mustAccept("You must be 18 or older"),
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
