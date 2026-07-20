import { z } from "zod";

/**
 * International phone number validation.
 * Accepts:
 *   - Optional leading + sign
 *   - 7 to 15 digits (E.164 spec range)
 *   - May include single spaces, hyphens, or parentheses (stripped during validation)
 *
 * Rejects:
 *   - Too short (under 7 digits)
 *   - Too long (over 15 digits)
 *   - Letters or invalid characters
 */
export const phoneSchema = z
  .string()
  .transform((val) => val.replace(/[\s\-()]/g, ""))
  .refine(
    (val) => /^\+?\d{7,15}$/.test(val),
    "Enter a valid phone number (7-15 digits, optional + prefix)",
  );

// Use this when phone is optional
export const optionalPhoneSchema = z
  .union([z.literal(""), phoneSchema])
  .default("");

/** Non-empty phone using the same rules as `phoneSchema`. */
export const requiredPhoneSchema = z
  .string()
  .min(1, "Phone is required")
  .transform((val) => val.replace(/[\s\-()]/g, ""))
  .refine(
    (val) => /^\+?\d{7,15}$/.test(val),
    "Enter a valid phone number (7-15 digits, optional + prefix)",
  );

/* ------------------------------------------------------------------ */
/* India (+91) OTP verification helpers                                */
/* ------------------------------------------------------------------ */

/** Dialing code that requires OTP verification. */
export const INDIA_DIALING_CODE = "+91";

/** Indian mobile: 10 digits starting 6-9 (national number, no country code). */
export const indianMobileNumberSchema = z
  .string()
  .transform((val) => val.replace(/[\s\-()]/g, ""))
  .refine(
    (val) => /^[6-9]\d{9}$/.test(val),
    "Enter a valid 10-digit Indian mobile number",
  );

/** Combine a dialing code and a national number into E.164 (e.g. "+919876543210"). */
export function toE164(countryCode: string, nationalNumber: string): string {
  const cc = countryCode.trim();
  const national = nationalNumber.replace(/[\s\-()]/g, "");
  const normalizedCc = cc.startsWith("+") ? cc : `+${cc}`;
  return `${normalizedCc}${national}`;
}

/** True when the E.164 number is an Indian (+91) number. */
export function isIndianPhone(e164: string | null | undefined): boolean {
  return typeof e164 === "string" && e164.startsWith(INDIA_DIALING_CODE);
}

/** MSG91 widget/API expect the number in international format WITHOUT the leading "+". */
export function toWidgetMobile(e164: string): string {
  return e164.replace(/^\+/, "");
}
