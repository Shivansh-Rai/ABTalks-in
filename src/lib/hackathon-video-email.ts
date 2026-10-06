import "server-only";
import { VIDEOTHON } from "@/features/hackathon-video/config";
import { hashRecipient, sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * VideoThon welcome email. Simpler than the code hackathon's four-variant
 * pipeline (leader/member/join) because VideoThon is solo-only — one email,
 * one path. Failures are logged and never block registration.
 *
 * Plain on purpose: no logo banner, badge or coloured button. A registration
 * confirmation is one-to-one mail and should land in Primary / Updates, and
 * Gmail files newsletter-looking layouts under Promotions.
 */
export async function sendVideoWelcomeEmail(
  fullName: string,
  email: string,
): Promise<void> {
  const firstName = (fullName.split(" ")[0] ?? fullName).trim() || "there";
  const whatsappHtml = VIDEOTHON.whatsappLink
    ? `<p style="margin:0 0 16px;">Kickoff updates and the brief are shared in the WhatsApp group: <a href="${VIDEOTHON.whatsappLink}" style="color:#03535F;">${VIDEOTHON.whatsappLink}</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${VIDEOTHON.name} registration</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#353535;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;">Your registration for ${VIDEOTHON.name} is confirmed.</p>
    <p style="margin:0 0 16px;">${VIDEOTHON.tagline}</p>
    <p style="margin:0 0 6px;font-weight:700;">Dates</p>
    <p style="margin:0 0 16px;">
      Kickoff: ${VIDEOTHON.kickoffLabel}<br>
      Deadline: ${VIDEOTHON.deadlineLabel}<br>
      ${VIDEOTHON.resultsLabel}
    </p>
    ${whatsappHtml}
    <p style="margin:0 0 24px;">Thanks,<br>The ABTalks team</p>
    <p style="margin:0;font-size:12px;color:#8A8A8A;border-top:1px solid #E9E9E9;padding-top:16px;">
      You received this email because ${email} was used to register for ${VIDEOTHON.name}. If that was a mistake, reply to this email.
    </p>
  </div>
</body>
</html>`;

  const text = [
    `Hi ${firstName},`,
    "",
    `Your registration for ${VIDEOTHON.name} is confirmed.`,
    "",
    VIDEOTHON.tagline,
    "",
    "Dates",
    `Kickoff: ${VIDEOTHON.kickoffLabel}`,
    `Deadline: ${VIDEOTHON.deadlineLabel}`,
    VIDEOTHON.resultsLabel,
    "",
    VIDEOTHON.whatsappLink
      ? `Kickoff updates and the brief are shared in the WhatsApp group: ${VIDEOTHON.whatsappLink}\n`
      : "",
    "Thanks,",
    "The ABTalks team",
    "",
    "---",
    `You received this email because ${email} was used to register for ${VIDEOTHON.name}. If that was a mistake, reply to this email.`,
  ].join("\n");

  try {
    await sendEmail({
      to: email,
      toName: fullName,
      subject: `Your ${VIDEOTHON.name} registration is confirmed`,
      html,
      text,
      kind: "videothon.confirmation",
    });
  } catch (error) {
    logger.error("videothon welcome email failed", {
      error: String(error),
      recipientHash: hashRecipient(email),
    });
  }
}
