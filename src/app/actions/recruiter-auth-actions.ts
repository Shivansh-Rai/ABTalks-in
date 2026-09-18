"use server";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { isRecruiterAuthEnabled } from "@/lib/feature-flags";
import { provisionRecruiterIdentity } from "@/features/hire/provision-recruiter";
import { sendEmail } from "@/lib/email";
import { recordLegalConsents } from "@/features/legal/record-consent";
import { recordNewsletterOptIn } from "@/features/legal/record-newsletter-optin";
import { attributeUtmToUser } from "@/features/utm/attribute";
import {
  findLiveSeat,
  issueRecruiterOtp,
  normaliseEmail,
  otpDevFallbackEnabled,
  purgeExpiredOtps,
  verifyRecruiterOtp,
  type OtpIntent,
} from "@/features/recruiter-auth/otp";
import {
  registerRecruiterSchema,
  requestRecruiterOtpSchema,
} from "@/lib/validations/recruiter-auth";
import {
  WORK_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmailDomain,
} from "@/lib/validations/work-email";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const SUPPORT_EMAIL = "team@abtalks.in";

async function deliverCode(
  email: string,
  code: string,
): Promise<{ devCode?: string }> {
  // The code leaves the server exactly one way: by email in production, or on
  // screen in development when there is no mail provider configured.
  if (otpDevFallbackEnabled()) {
    // The code is returned to the caller, which is how the dev flow surfaces
    // it. It used to be logged next to the address as well - a one-time
    // credential and a private email on one line, which T-259 forbids and
    // which the return value already made redundant.
    logger.warn(
      { event: "recruiter.otp.dev_fallback" },
      "OTP returned to the caller instead of emailed (dev fallback)",
    );
    return { devCode: code };
  }
  await sendEmail({
    to: email,
    kind: "recruiter.otp",
    tags: ["recruiter-otp", "transactional"],
    // Plan 152: code in the subject line. Gmail's snippet expansion shows it
    // one-tap-copy, and modern spam filters treat "code: NNNNNN" as clearly
    // transactional. The word "verification" is spam-heavy and is dropped;
    // "sign-in code" reads the same to a human and better to a filter.
    subject: `Your ABTalks sign-in code is ${code}`,
    html: renderOtpHtml(code),
    text: renderOtpText(code),
  });
  return {};
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.abtalks.in";
const LOGO_URL = `${APP_URL}/abtalks-logo.png`;

/**
 * Plan 152. Full HTML5 transactional email for the recruiter sign-in code.
 *
 * A 3-line HTML fragment (the previous template) is one of the strongest
 * heuristics Gmail and Outlook use to route mail to spam — legit transactional
 * senders always ship a proper HTML document with a preheader, a body, and a
 * footer. The layout borrows the workshop-email conventions so the two feel
 * like the same product.
 */
function renderOtpHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Your ABTalks sign-in code</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F4;font-family:Inter,'Segoe UI',Arial,sans-serif;">
  <!-- Preheader: shown in the inbox snippet next to the subject line. Kept short so it doesn't wrap into the body. -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F4F4F4;opacity:0;">
    Use ${code} to sign in to ABTalks. It expires in 10 minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#03535F,#076573);padding:28px;text-align:center;">
              <img src="${LOGO_URL}" alt="ABTalks" width="140" style="display:block;margin:0 auto;height:auto;max-width:140px;border:0;outline:none;text-decoration:none;" />
              <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:8px 0 0;letter-spacing:0.3px;">Recruiter sign-in</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="color:#0F1720;font-size:20px;line-height:1.35;margin:0 0 8px;font-weight:600;">Your ABTalks sign-in code</h1>
              <p style="color:#4b4b4b;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Enter this code on the sign-in screen to continue. The code is valid for the next 10 minutes.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E7F2F3;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td align="center" style="padding:24px;">
                    <p style="color:#076573;font-size:12px;margin:0 0 6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Sign-in code</p>
                    <p style="color:#03535F;font-size:34px;font-weight:700;letter-spacing:8px;margin:0;font-family:'Menlo','Consolas',ui-monospace,monospace;">${code}</p>
                  </td>
                </tr>
              </table>
              <p style="color:#4b4b4b;font-size:14px;line-height:1.6;margin:0 0 16px;">
                If you didn&rsquo;t try to sign in to ABTalks, you can safely ignore this email &mdash; no changes have been made to any account.
              </p>
              <p style="color:#4b4b4b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Need a hand? Write to <a href="mailto:team@abtalks.in" style="color:#03535F;text-decoration:underline;">team@abtalks.in</a> and someone from the team will help.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px;border-top:1px solid #EFEFEF;">
              <p style="color:#8A8A8A;font-size:12px;line-height:1.6;margin:0 0 6px;">
                This is a transactional message from ABTalks, sent because someone requested a sign-in code for this address. If that wasn&rsquo;t you, no action is needed.
              </p>
              <p style="color:#8A8A8A;font-size:12px;line-height:1.6;margin:0;">
                ABTalks &middot; <a href="${APP_URL}" style="color:#8A8A8A;text-decoration:underline;">abtalks.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderOtpText(code: string): string {
  return `Your ABTalks sign-in code

Enter this code on the sign-in screen to continue:

  ${code}

The code is valid for the next 10 minutes.

If you didn't try to sign in to ABTalks, you can safely ignore this email — no changes have been made to any account.

Need a hand? Write to team@abtalks.in.

—
This is a transactional message from ABTalks (${APP_URL}).`;
}

/**
 * Send a code, for registering or for signing in.
 *
 * The two differ in what they can refuse. Registration is open, so the only
 * refusal is "you already have an account — sign in instead". Signing in needs
 * a registration to exist, and says so rather than silently emailing a code
 * that could never be used for anything.
 */
export async function requestRecruiterOtpAction(
  input: unknown,
): Promise<ActionResult<{ sent: true; devCode?: string }>> {
  const parsed = requestRecruiterOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid work email address." };
  }
  if (!isRecruiterAuthEnabled()) {
    return {
      ok: false,
      message: "Recruiter sign-in and registration aren't open yet.",
    };
  }
  const intent: OtpIntent = parsed.data.intent;

  // Registering a personal mailbox is refused here rather than after the code
  // is typed, so nobody spends a round trip on an address that can never become
  // an account. Signing in is left alone: it needs an existing registration,
  // and that registration already had to pass this rule.
  if (intent === "register" && isPersonalEmailDomain(parsed.data.email)) {
    return { ok: false, message: WORK_EMAIL_REQUIRED_MESSAGE };
  }

  try {
    void purgeExpiredOtps();

    const issued = await issueRecruiterOtp(parsed.data.email, intent);
    if (!issued.ok) {
      if (issued.reason === "rate-limited") {
        return {
          ok: false,
          message: "Too many codes requested. Try again in a few minutes.",
        };
      }
      if (issued.reason === "already-registered") {
        return {
          ok: false,
          message: "This email is already registered. Sign in instead.",
        };
      }
      return {
        ok: false,
        message:
          "We have no registration for this email. Register first and we'll be in touch.",
      };
    }

    const { devCode } = await deliverCode(parsed.data.email, issued.code);
    return { ok: true, data: { sent: true, ...(devCode ? { devCode } : {}) } };
  } catch (error) {
    logger.error("[recruiter-auth] requestRecruiterOtpAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not send a code. Try again." };
  }
}

/**
 * Complete registration once the emailed code proves the address.
 *
 * The account is live the moment the code is verified: the profile is created,
 * the workspace is provisioned and funded, and the recruiter signs in to
 * /hire. There is no application to review. The profile used to be created
 * unapproved unless the address matched a `VerifiedRecruiterSeat`, which parked
 * everybody else on an "Application received" screen until an admin acted.
 *
 * The work-email rule is unaffected and still refuses a personal domain twice,
 * before anything is written. A seat now only supplies the company name.
 */
export async function registerRecruiterWithOtpAction(
  input: unknown,
): Promise<ActionResult<{ approved: boolean }>> {
  const parsed = registerRecruiterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }
  if (!isRecruiterAuthEnabled()) {
    return {
      ok: false,
      message: "Recruiter sign-in and registration aren't open yet.",
    };
  }
  const { fullName, company, phone, email, code, newsletterOptIn } =
    parsed.data;
  const normalised = normaliseEmail(email);

  // Checked again on the normalised address, at the boundary that actually
  // creates the account. The schema above already refuses this, so reaching
  // here means the schema was bypassed — which is exactly when it matters.
  if (isPersonalEmailDomain(normalised)) {
    return { ok: false, message: WORK_EMAIL_REQUIRED_MESSAGE };
  }

  try {
    const verified = await verifyRecruiterOtp(normalised, code);
    if (!verified.ok) {
      return {
        ok: false,
        message:
          verified.reason === "too-many"
            ? "Too many wrong codes. Request a new one."
            : verified.reason === "expired"
              ? "That code expired. Request a new one."
              : "That code isn't right.",
      };
    }

    const already = await prisma.user.findFirst({
      where: { email: normalised },
      select: { id: true, recruiterProfile: { select: { id: true } } },
    });
    if (already?.recruiterProfile) {
      return { ok: false, message: "This email is already registered." };
    }

    // Company name only. A seat is no longer an access decision.
    const seat = await findLiveSeat(normalised);
    const resolvedCompany = seat?.company ?? company;
    const now = new Date();

    const userId = await prisma.$transaction(async (tx) => {
      const id =
        already?.id ??
        (
          await tx.user.create({
            data: {
              email: normalised,
              name: fullName,
              role: "RECRUITER",
              // The code proved the address. Nothing else here does.
              emailVerified: new Date(),
            },
            select: { id: true },
          })
        ).id;

      await tx.recruiterProfile.create({
        data: {
          userId: id,
          fullName,
          company: resolvedCompany,
          phone: phone || null,
          // Written, never read as a gate. See ensureRecruiterWorkspace.
          approved: true,
          approvedAt: now,
          setupStep: "COMPLETE",
          setupCompletedAt: now,
        },
      });

      if (already) {
        await tx.user.update({ where: { id }, data: { role: "RECRUITER" } });
      }

      // Always. The workspace — Organization, OrganizationMember, the
      // RECRUITER role assignment and the starting credit grant — is what
      // registering gets you, and it is created in the same commit as the
      // profile so the two can never disagree.
      await provisionRecruiterIdentity(tx, {
        userId: id,
        company: resolvedCompany,
      });
      return id;
      // The same window ensureRecruiterWorkspace and the credit grant use.
      // Prisma's 5s default is not enough for this many sequential writes over
      // Neon: it timed out at ~5.3s, rolled everything back, and — because the
      // code had already been consumed — the retry told the recruiter a correct
      // code "isn't right".
    }, { maxWait: 20_000, timeout: 20_000 });

    // Credentials sign-ins bypass the adapter, so no createUser event fires —
    // consent is recorded here or it is not recorded at all.
    try {
      await recordLegalConsents({
        userId,
        email: normalised,
        source: "talent_register",
      });
      await recordNewsletterOptIn({
        email: normalised,
        optIn: newsletterOptIn,
        source: "talent_register",
      });
    } catch (error) {
      logger.error("[recruiter-auth] consent record failed", {
        error: String(error),
      });
    }

    // T-254: first-touch UTM attribution. Best-effort — failure never blocks
    // the recruiter's signup, and the write itself is a no-op if the row
    // already has any UTM value.
    void attributeUtmToUser(userId);

    return { ok: true, data: { approved: true } };
  } catch (error) {
    logger.error("[recruiter-auth] registerRecruiterWithOtpAction", {
      error: String(error),
    });
    // The code was consumed before this failed, so it cannot be reused. Say
    // so — otherwise the retry reports a correct code as wrong.
    return {
      ok: false,
      message: `Could not complete registration. Request a new code and try again, or write to ${SUPPORT_EMAIL} if this keeps happening.`,
    };
  }
}
