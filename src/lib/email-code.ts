import "server-only";

import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

/*
 * Emailed one-time codes (plan 154).
 *
 * This began as the recruiter sign-in OTP (`features/recruiter-auth/otp.ts`,
 * which now delegates here). Candidates' sign-in and everyone's password
 * set / reset use the same table, hashing, expiry and attempt budget; the
 * `purpose` column is what keeps a code for one job from being spent on
 * another.
 */

const CODE_LENGTH = 6;
export const EMAIL_CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type EmailCodePurpose =
  /** Recruiter sign-in. The stored value predates plan 154. */
  | "login"
  /** Recruiter registration. */
  | "register"
  | "candidate-login"
  | "password-reset";

const PURPOSES: readonly EmailCodePurpose[] = [
  "login",
  "register",
  "candidate-login",
  "password-reset",
];

function isPurpose(value: string): value is EmailCodePurpose {
  return (PURPOSES as readonly string[]).includes(value);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * sha256(value + AUTH_SECRET).
 *
 * The column is `codeHash`, and it means it — a plaintext code in the database
 * is a password in the database. The secret is a pepper: without it, a stolen
 * table plus six digits of search space is no protection at all.
 */
function pepperedHash(value: string): string {
  return createHash("sha256")
    .update(`${value}${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Rate-limit subject for an address. Hashed so `RateLimitEvent` never holds an
 * email — the anonymizer does not know that table exists.
 */
export function emailRateLimitSubject(email: string): string {
  return `email:${pepperedHash(normaliseEmail(email)).slice(0, 32)}`;
}

/**
 * The dev escape hatch: show the code instead of emailing it.
 *
 * Both conditions, always. A deployed environment that happens to be missing
 * the mail key must not start handing out other people's sign-in codes, so
 * the NODE_ENV check is the one that actually protects this — the missing key
 * only decides whether it is *needed*.
 */
export function otpDevFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.BREVO_API_KEY;
}

export type IssueEmailCodeResult =
  | {
      ok: true;
      /**
       * The plaintext code, returned to the *server* caller so it can be
       * emailed. It must never be put in a Server Action response outside the
       * dev fallback — see `deliverEmailCode`.
       */
      code: string;
    }
  | {
      ok: false;
      reason: "rate-limited";
      /** The limiter's own words — a real quota, or the limiter being down. */
      message: string;
    };

/**
 * Create a code for an email. One live code per address: issuing deletes any
 * older one, whatever its purpose.
 *
 * Callers decide whether the address may have a code at all; this only
 * enforces how many it may have.
 */
export async function issueEmailCode(
  rawEmail: string,
  purpose: EmailCodePurpose,
): Promise<IssueEmailCodeResult> {
  const email = normaliseEmail(rawEmail);

  // Counted in RateLimitEvent, not on this table: every issue deletes the
  // previous row, so a count here could never exceed one.
  const allowed = await assertRateLimit({
    bucket: "EMAIL_CODE_ADDRESS",
    subjectId: emailRateLimitSubject(email),
  });
  if (!allowed.ok) {
    return { ok: false, reason: "rate-limited", message: allowed.message };
  }

  // randomInt, not Math.random: this is a credential, however short-lived.
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(
    CODE_LENGTH,
    "0",
  );

  await prisma.$transaction([
    // One live code per email. An older one lying around is a second key.
    prisma.recruiterEmailOtp.deleteMany({ where: { email } }),
    prisma.recruiterEmailOtp.create({
      data: {
        email,
        codeHash: pepperedHash(code),
        purpose,
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
      },
      select: { id: true },
    }),
  ]);

  return { ok: true, code };
}

export type VerifyEmailCodeResult =
  | { ok: true; email: string; purpose: EmailCodePurpose }
  | { ok: false; reason: "invalid" | "expired" | "too-many" };

/**
 * Check a code. By default it is consumed: deleted on success, so one code
 * buys one sign-in. Deleted after the attempt budget too — a code someone is
 * guessing at is a code that should stop existing.
 *
 * `purposes` is the set this caller accepts. A code issued for anything else
 * is treated as a wrong code, attempt counted, so a sign-in code can never
 * reset a password and a reset code can never open a session.
 *
 * `{ consume: false }` peeks: recruiter registration verifies, writes the
 * account, then spends the same digits on `signIn("recruiter-otp")`.
 */
export async function verifyEmailCode(
  rawEmail: string,
  code: string,
  opts: { purposes: readonly EmailCodePurpose[]; consume?: boolean },
): Promise<VerifyEmailCodeResult> {
  const consume = opts.consume !== false;
  const email = normaliseEmail(rawEmail);

  const row = await prisma.recruiterEmailOtp.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      codeHash: true,
      purpose: true,
      attempts: true,
      expiresAt: true,
    },
  });
  if (!row) return { ok: false, reason: "invalid" };

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.recruiterEmailOtp.delete({ where: { id: row.id } });
    return { ok: false, reason: "expired" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.recruiterEmailOtp.delete({ where: { id: row.id } });
    return { ok: false, reason: "too-many" };
  }

  const purposeAccepted =
    isPurpose(row.purpose) && opts.purposes.includes(row.purpose);
  if (!purposeAccepted || !safeEqual(pepperedHash(code.trim()), row.codeHash)) {
    const next = row.attempts + 1;
    if (next >= MAX_ATTEMPTS) {
      await prisma.recruiterEmailOtp.delete({ where: { id: row.id } });
      return { ok: false, reason: "too-many" };
    }
    await prisma.recruiterEmailOtp.update({
      where: { id: row.id },
      data: { attempts: next },
      select: { id: true },
    });
    return { ok: false, reason: "invalid" };
  }

  if (consume) {
    await prisma.recruiterEmailOtp.delete({ where: { id: row.id } });
  }
  return { ok: true, email, purpose: row.purpose as EmailCodePurpose };
}

/** User-facing sentence for a failed verification. */
export function emailCodeFailureMessage(
  reason: "invalid" | "expired" | "too-many",
): string {
  if (reason === "too-many") return "Too many wrong codes. Request a new one.";
  if (reason === "expired") return "That code expired. Request a new one.";
  return "That code isn't right.";
}

/** Housekeeping for expired rows; safe to call from anywhere. */
export async function purgeExpiredEmailCodes(): Promise<number> {
  try {
    const { count } = await prisma.recruiterEmailOtp.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  } catch (error) {
    logger.error("[email-code] purgeExpiredEmailCodes", {
      error: String(error),
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Which email to send. All three share one plain layout (`renderCodeHtml`);
 * do not add images, banners or marketing copy to it without re-checking
 * where Gmail files the result.
 */
export type EmailCodeVariant = "recruiter-signin" | "signin" | "password";

type TemplateCopy = {
  kind: string;
  tags: string[];
  subject: (code: string) => string;
  title: string;
  label: string;
  preheader: (code: string) => string;
  introHtml: string;
  introText: string;
  codeLabel: string;
  ignoreHtml: string;
  ignoreText: string;
  footerReason: string;
};

const SIGNIN_COPY: Omit<TemplateCopy, "kind" | "tags" | "label"> = {
  // Plan 152: code in the subject line. Gmail's snippet expansion shows it
  // one-tap-copy, and modern spam filters treat "code: NNNNNN" as clearly
  // transactional. The word "verification" is spam-heavy and is dropped;
  // "sign-in code" reads the same to a human and better to a filter.
  subject: (code) => `Your ABTalks sign-in code is ${code}`,
  title: "Your ABTalks sign-in code",
  preheader: (code) =>
    `Use ${code} to sign in to ABTalks. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
  introHtml: `Enter this code on the sign-in screen to continue. The code is valid for the next ${EMAIL_CODE_TTL_MINUTES} minutes.`,
  introText: "Enter this code on the sign-in screen to continue:",
  codeLabel: "Sign-in code",
  ignoreHtml:
    "If you didn&rsquo;t try to sign in to ABTalks, you can safely ignore this email &mdash; no changes have been made to any account.",
  ignoreText:
    "If you didn't try to sign in to ABTalks, you can safely ignore this email — no changes have been made to any account.",
  footerReason: "someone requested a sign-in code for this address",
};

const COPY: Record<EmailCodeVariant, TemplateCopy> = {
  "recruiter-signin": {
    ...SIGNIN_COPY,
    kind: "recruiter.otp",
    tags: ["recruiter-otp", "transactional"],
    label: "Recruiter sign-in",
  },
  signin: {
    ...SIGNIN_COPY,
    kind: "auth.signin_code",
    tags: ["signin-code", "transactional"],
    label: "Sign in",
  },
  password: {
    kind: "auth.password_code",
    tags: ["password-code", "transactional"],
    subject: (code) => `Your ABTalks password code is ${code}`,
    title: "Your ABTalks password code",
    label: "Password",
    preheader: (code) =>
      `Use ${code} to set your ABTalks password. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
    introHtml: `Enter this code to set a new password for your ABTalks account. The code is valid for the next ${EMAIL_CODE_TTL_MINUTES} minutes.`,
    introText: "Enter this code to set a new password for your ABTalks account:",
    codeLabel: "Password code",
    ignoreHtml:
      "If you didn&rsquo;t ask to set or reset your ABTalks password, you can safely ignore this email &mdash; your password has not been changed.",
    ignoreText:
      "If you didn't ask to set or reset your ABTalks password, you can safely ignore this email — your password has not been changed.",
    footerReason: "someone requested a password code for this address",
  },
};

/**
 * Send a code. The code leaves the server exactly one way: by email in
 * production, or back to the caller in development when there is no mail
 * provider configured (`devCode`, shown on screen).
 */
export async function deliverEmailCode(
  email: string,
  code: string,
  variant: EmailCodeVariant,
): Promise<{ devCode?: string }> {
  const copy = COPY[variant];
  if (otpDevFallbackEnabled()) {
    // Never logged next to the address: a one-time credential and a private
    // email on one line is what T-259 forbids.
    logger.warn(
      { event: `${copy.kind}.dev_fallback` },
      "Code returned to the caller instead of emailed (dev fallback)",
    );
    return { devCode: code };
  }
  await sendEmail({
    to: email,
    kind: copy.kind,
    tags: copy.tags,
    subject: copy.subject(code),
    html: renderCodeHtml(copy, code),
    text: renderCodeText(copy, code),
  });
  return {};
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.abtalks.in";

/**
 * Full HTML5 document for a one-time code, deliberately plain.
 *
 * Gmail sorts mail into Primary / Updates / Promotions largely on how it
 * looks. A logo image, a gradient banner, card shadows and coloured panels
 * read as a newsletter, and that is how sign-in codes ended up under
 * Promotions. This is one column of text, the code in large type, no images
 * and a single link — the shape of a message from a service to one person.
 * The preheader stays: it puts the code in the inbox snippet.
 */
export function renderCodeHtml(copy: TemplateCopy, code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${copy.preheader(code)}</div>
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#353535;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">${copy.title}</p>
    <p style="margin:0 0 16px;">${copy.introHtml}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">${copy.codeLabel}</p>
    <p style="margin:0 0 20px;font-size:30px;font-weight:700;letter-spacing:6px;color:#000000;font-family:Menlo,Consolas,monospace;">${code}</p>
    <p style="margin:0 0 16px;">Do not share this code with anyone. ABTalks will never ask you for it.</p>
    <p style="margin:0 0 16px;">${copy.ignoreHtml}</p>
    <p style="margin:0 0 24px;">Thanks,<br>The ABTalks team</p>
    <p style="margin:0;font-size:12px;color:#8A8A8A;border-top:1px solid #E9E9E9;padding-top:16px;">
      You received this email because ${copy.footerReason} on <a href="${APP_URL}" style="color:#8A8A8A;">abtalks.in</a>. Questions? Reply to this email.
    </p>
  </div>
</body>
</html>`;
}

export function renderCodeText(copy: TemplateCopy, code: string): string {
  return `${copy.title}

${copy.introText}

${code}

The code is valid for the next ${EMAIL_CODE_TTL_MINUTES} minutes. Do not share this code with anyone. ABTalks will never ask you for it.

${copy.ignoreText}

Thanks,
The ABTalks team

---
You received this email because ${copy.footerReason} on abtalks.in. Questions? Reply to this email.`;
}

/** Exposed for the template regression test only. */
export const EMAIL_CODE_COPY = COPY;
