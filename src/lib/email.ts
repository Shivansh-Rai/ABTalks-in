import "server-only";
import { BrevoClient } from "@getbrevo/brevo";
import { reqLogger } from "@/lib/logger";
import {
  hashRecipient,
  newDeliveryId,
  recordDelivery,
} from "@/lib/observability/notification-delivery";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Transactional mail, through Brevo.
 *
 * This used to call Resend, and nothing that reaches it ever sent: `RESEND_API_KEY`
 * is not configured anywhere, so every caller was quietly taking the
 * `skipped: true` branch. That is five paths, three of them recruiter-facing —
 * the sign-in code, the admin's approval mail and the hire alert — plus the
 * contact form and DSAR notifications. In development the recruiter one hides
 * behind `otpDevFallbackEnabled`, which prints the code to the log instead, so
 * the failure only showed up in production, where nobody could sign in and
 * nothing said why.
 *
 * Brevo is the provider this project actually has credentials for and already
 * uses for the workshop, hackathon and challenge-reset mail. One provider
 * beats two, and beats one that is only configured on paper.
 *
 * ## T-259
 *
 * This is the single choke point for outbound mail, so it is where the
 * notification bridge lives: every call allocates a `deliveryId`, writes a
 * `NotificationDelivery` row, emits `notification.attempt` / `.sent` /
 * `.skipped` / `.failed`, and reports failures to Sentry tagged with that same
 * id. The recipient address never reaches a log line or a Sentry payload —
 * only its SHA-256.
 *
 * The result shape only gained fields, so no caller had to move.
 */

const FROM_EMAIL = process.env.FROM_EMAIL || "team@abtalks.in";
const FROM_NAME = process.env.FROM_NAME || "ABTalks";
const REPLY_TO = process.env.REPLY_TO_EMAIL || FROM_EMAIL;

export type SendEmailResult =
  | { ok: true; deliveryId: string }
  | {
      ok: false;
      skipped?: boolean;
      deliveryId: string;
      /** Redacted, safe to persist or show to an admin. */
      reason?: string;
      sentryEventId?: string;
    };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
  /** T-259: what this message is, e.g. "recruiter.otp". Defaults to "generic". */
  kind?: string;
  /** T-259: the domain entity it belongs to, when there is one. */
  subjectType?: string;
  subjectId?: string;
}): Promise<SendEmailResult> {
  const deliveryId = newDeliveryId();
  const kind = opts.kind ?? "generic";
  const requestId = await getRequestId();
  const log = reqLogger(requestId, { kind, deliveryId, channel: "email" });
  const ctx = {
    kind,
    recipient: opts.to,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    requestId,
    log,
  };

  // The subject line is app-authored copy, never user input, so it is the one
  // thing here that is safe to log. The address is not: only its hash goes out.
  log.info(
    {
      event: "notification.attempt",
      recipientHash: hashRecipient(opts.to),
      hasAttachments: Boolean(opts.attachments?.length),
    },
    "notification attempt",
  );

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    const { reason } = await recordDelivery(deliveryId, ctx, {
      status: "SKIPPED",
      reason: "BREVO_API_KEY missing",
    });
    return { ok: false, skipped: true, deliveryId, reason };
  }
  // Never email seed/test accounts (avoid bounces hurting domain reputation).
  if (opts.to.toLowerCase().endsWith("@abtalks.dev")) {
    const { reason } = await recordDelivery(deliveryId, ctx, {
      status: "SKIPPED",
      reason: "test address",
    });
    return { ok: false, skipped: true, deliveryId, reason };
  }

  try {
    const brevo = new BrevoClient({ apiKey });
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      replyTo: { email: REPLY_TO },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
      // Brevo wants base64, not a Buffer. No caller passes attachments today,
      // but the signature offered them, and a silently dropped attachment is
      // worse than one that was never offered.
      ...(opts.attachments?.length
        ? {
            attachment: opts.attachments.map((a) => ({
              name: a.filename,
              content: a.content.toString("base64"),
            })),
          }
        : {}),
    });
    await recordDelivery(deliveryId, ctx, { status: "SENT" });
    return { ok: true, deliveryId };
  } catch (error) {
    // Brevo echoes the request — recipient address included — back inside the
    // error. `recordDelivery` runs it through `safeErrorMessage`, which is the
    // whole reason `String(error)` is not used here any more.
    const { reason, sentryEventId } = await recordDelivery(deliveryId, ctx, {
      status: "FAILED",
      error,
    });
    return { ok: false, deliveryId, reason, sentryEventId };
  }
}

/** Re-exported so callers can look a delivery up without importing two modules. */
export { hashRecipient };
