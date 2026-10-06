import "server-only";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Sent when an admin approves a 60-Day Claude AI Challenge reset.
 *
 * Plain on purpose. The previous version had a gradient banner, a big black
 * button and a row of social-media icons hot-linked from Brevo's marketing
 * editor (creative-assets.mailinblue.com) — that last one in particular marks
 * a message as a campaign, and it landed in Promotions. This is an update
 * about the recipient's own account, so it is written and laid out like one.
 */
export function challengeResetEmail(input: {
  firstName: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { firstName, dashboardUrl } = input;
  const subject = "Your 60-Day Claude AI Challenge progress has been reset";

  const text = `Hi ${firstName},

Your request to reset your challenge has been approved. Your progress in the ABTalks 60-Day Claude AI Challenge has been reset, and you now start again from Day 1.

Important: to stay in the challenge, submit your Day 1 task before 12:00 AM (midnight) IST today.

Open your dashboard: ${dashboardUrl}

If you did not ask for this reset, reply to this email and we will look into it.

Thanks,
The ABTalks team

---
You received this email because a challenge reset was requested for your ABTalks account.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#353535;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;">Your request to reset your challenge has been approved. Your progress in the <strong>ABTalks 60-Day Claude AI Challenge</strong> has been reset, and you now start again from <strong>Day 1</strong>.</p>
    <p style="margin:0 0 16px;"><strong>Important:</strong> to stay in the challenge, submit your Day 1 task before 12:00 AM (midnight) IST today.</p>
    <p style="margin:0 0 16px;">Open your dashboard: <a href="${dashboardUrl}" style="color:#03535F;">${dashboardUrl}</a></p>
    <p style="margin:0 0 16px;">If you did not ask for this reset, reply to this email and we will look into it.</p>
    <p style="margin:0 0 24px;">Thanks,<br>The ABTalks team</p>
    <p style="margin:0;font-size:12px;color:#8A8A8A;border-top:1px solid #E9E9E9;padding-top:16px;">
      You received this email because a challenge reset was requested for your ABTalks account.
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Sends the challenge-reset confirmation through the shared transport.
 * Best-effort: never throws — logs and returns on failure so it can't break
 * the admin reset it's called from. `sendEmail` already skips a missing key
 * and seed addresses and records the delivery.
 */
export async function sendChallengeResetEmail(input: {
  to: string;
  firstName: string;
  dashboardUrl: string;
}): Promise<void> {
  const { subject, html, text } = challengeResetEmail({
    firstName: input.firstName,
    dashboardUrl: input.dashboardUrl,
  });

  try {
    const result = await sendEmail({
      to: input.to,
      toName: input.firstName,
      subject,
      html,
      text,
      kind: "challenge.reset",
    });
    if (!result.ok && !result.skipped) {
      logger.error("[challenge-reset-email] send failed", {
        deliveryId: result.deliveryId,
        reason: result.reason,
      });
    }
  } catch (e) {
    logger.error("[challenge-reset-email] send failed", { error: String(e) });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
