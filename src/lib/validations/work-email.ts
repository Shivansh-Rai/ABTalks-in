import { z } from "zod";

/**
 * Work-email enforcement for recruiter accounts (T-225).
 *
 * A recruiter account is a claim to represent a company, and the only cheap
 * signal we have for that claim is the domain the person can receive mail at.
 * A free consumer mailbox proves nothing, so it cannot become a recruiter
 * account — on any path, with no exception.
 *
 * There is deliberately no environment variable, no database table and no admin
 * override behind this list. An allowlist of any shape would be the exception
 * mechanism T-225 exists to remove, so the list is source, reviewed like source.
 *
 * The list is not an attempt to enumerate every free provider on the internet —
 * that is unwinnable and would start refusing legitimate small-company domains
 * by accident. It covers the mass-market consumer providers an Indian
 * jobs-market recruiter would plausibly type in: the four named in T-225, their
 * own aliases and regional variants, and the handful of others in the same
 * class. Adding one is a one-line change here.
 */
export const PERSONAL_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Yahoo, including the Indian variants
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.in",
  "ymail.com",
  "rocketmail.com",
  // Microsoft consumer
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.in",
  "live.com",
  "live.in",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Proton
  "protonmail.com",
  "proton.me",
  // Other mass-market free mailboxes, incl. Rediff for the Indian market
  "aol.com",
  "gmx.com",
  "mail.com",
  "rediffmail.com",
  "rediff.com",
]);

/**
 * The single refusal wording, shared by every enforcement point.
 *
 * It names the rule and what to do instead. It does not hint at an appeal
 * route, because there isn't one.
 */
export const WORK_EMAIL_REQUIRED_MESSAGE =
  "Use your work email address. Free personal email providers such as Gmail, Yahoo, Hotmail and Outlook can't be used for a recruiter account.";

/** The lowercased domain of an address, or "" when there isn't one. */
export function emailDomain(email: string | null | undefined): string {
  if (typeof email !== "string") return "";
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return "";
  return email
    .trim()
    .toLowerCase()
    .slice(at + 1);
}

/**
 * True when the address belongs to a free consumer provider.
 *
 * Matches the domain exactly. A subdomain of a listed provider (`@x.gmail.com`)
 * is not one of their mailboxes, and a company domain that merely ends in a
 * listed one (`@notgmail.com`) is a real company.
 */
export function isPersonalEmailDomain(
  email: string | null | undefined,
): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(emailDomain(email));
}

/**
 * A recruiter-facing email field: valid address, work domain.
 *
 * Use this instead of `z.string().email()` anywhere an address is about to
 * become — or authorise — a recruiter account.
 */
export const workEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid work email.")
  .max(200)
  .refine(
    (value) => !isPersonalEmailDomain(value),
    WORK_EMAIL_REQUIRED_MESSAGE,
  );
