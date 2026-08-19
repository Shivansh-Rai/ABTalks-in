import "server-only";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { LEGAL_ENTITY } from "@/lib/legal-constants";

const TYPE_LABELS: Record<string, string> = {
  ACCESS: "Access",
  CORRECTION: "Correction",
  ERASURE: "Erasure / account deletion",
  OTHER: "Other",
};

/**
 * Alerts the team that a data-rights request arrived.
 *
 * The Privacy Policy commits to a 30-day response and the Grievance Officer to
 * a 24-hour acknowledgement — neither is possible if requests only ever land in
 * a table nobody reads. Never let a mail failure fail the user's request.
 */
export async function notifyDataRightsRequest(input: {
  id: string;
  email: string;
  type: string;
  message: string | null;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://abtalks.in";
  const label = TYPE_LABELS[input.type] ?? input.type;
  const adminUrl = `${appUrl}/admin/data-requests`;

  try {
    await sendEmail({
      to: LEGAL_ENTITY.grievanceOfficer.email,
      subject: `[Data rights] ${label} request from ${input.email}`,
      text: [
        `A new data-rights request was submitted.`,
        ``,
        `Type:    ${label}`,
        `From:    ${input.email}`,
        `Request: ${input.id}`,
        ``,
        `Message:`,
        input.message?.trim() || "(none)",
        ``,
        `Acknowledge within ${LEGAL_ENTITY.grievanceOfficer.acknowledgeWithin}.`,
        `Respond within 30 days (Privacy Policy §10).`,
        ``,
        `Review: ${adminUrl}`,
      ].join("\n"),
      html: [
        `<p>A new data-rights request was submitted.</p>`,
        `<table cellpadding="6">`,
        `<tr><td><strong>Type</strong></td><td>${escapeHtml(label)}</td></tr>`,
        `<tr><td><strong>From</strong></td><td>${escapeHtml(input.email)}</td></tr>`,
        `<tr><td><strong>Request</strong></td><td><code>${escapeHtml(input.id)}</code></td></tr>`,
        `</table>`,
        `<p><strong>Message</strong><br>${escapeHtml(input.message?.trim() || "(none)")}</p>`,
        `<p>Acknowledge within ${LEGAL_ENTITY.grievanceOfficer.acknowledgeWithin}. Respond within 30 days (Privacy Policy §10).</p>`,
        `<p><a href="${adminUrl}">Review pending requests</a></p>`,
      ].join(""),
    });
  } catch (error) {
    logger.error("[legal] data-rights notification failed", {
      requestId: input.id,
      error: String(error),
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
