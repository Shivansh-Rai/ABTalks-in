import "server-only";
import { sendEmail } from "@/lib/email";

/**
 * Workshop registration confirmation.
 *
 * Goes through the shared transport (`sendEmail`) so it gets a plain-text
 * part, a Reply-To and a delivery record like every other mail. The layout is
 * deliberately plain — no logo image, gradient banner or button — and the
 * subject states a fact instead of selling ("FREE" in capitals is a classic
 * Promotions-tab signal). A registration confirmation belongs in Primary /
 * Updates.
 *
 * Throws when the send fails so the caller's existing error log still fires.
 */
export async function sendWorkshopConfirmationEmail(
  name: string,
  email: string,
  config: { zoomLink: string; whatsappLink: string; webinarDate: string; webinarTime: string }
): Promise<void> {
  const { zoomLink, whatsappLink, webinarDate, webinarTime } = config;
  const firstName = name.trim().split(/\s+/)[0] || "there";

  // The seeded fallback config uses "#" as a placeholder. A dead link is worse
  // than a note that the link will follow.
  const hasZoomLink = Boolean(zoomLink) && zoomLink !== "#";
  const hasWhatsappLink = Boolean(whatsappLink) && whatsappLink !== "#";

  const joinHtml = hasZoomLink
    ? `<p style="margin:0 0 16px;">Join link (YouTube Live): <a href="${esc(zoomLink)}" style="color:#03535F;">${esc(zoomLink)}</a><br>Keep this email &mdash; the same link works on the day. Please join 5 to 10 minutes early.</p>`
    : `<p style="margin:0 0 16px;">We will email the YouTube Live link to this address before the session. Please join 5 to 10 minutes early.</p>`;
  const joinText = hasZoomLink
    ? `Join link (YouTube Live): ${zoomLink}\nKeep this email - the same link works on the day. Please join 5 to 10 minutes early.`
    : "We will email the YouTube Live link to this address before the session. Please join 5 to 10 minutes early.";

  const whatsappHtml = hasWhatsappLink
    ? `<p style="margin:0 0 16px;">Reminders and session resources are shared in the workshop WhatsApp group: <a href="${esc(whatsappLink)}" style="color:#03535F;">${esc(whatsappLink)}</a></p>`
    : "";
  const whatsappText = hasWhatsappLink
    ? `\nReminders and session resources are shared in the workshop WhatsApp group: ${whatsappLink}\n`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ABTalks workshop registration</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#353535;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 16px;">Your registration for the ABTalks workshop is confirmed. Here are the details:</p>
    <p style="margin:0 0 16px;">
      Date: ${esc(webinarDate)}<br>
      Time: ${esc(webinarTime)}<br>
      Where: YouTube Live
    </p>
    ${joinHtml}
    <p style="margin:0 0 16px;">It is a hands-on session, so join from a laptop if you can.</p>
    ${whatsappHtml}
    <p style="margin:0 0 24px;">If you can no longer attend, just reply to this email.</p>
    <p style="margin:0 0 24px;">Thanks,<br>The ABTalks team</p>
    <p style="margin:0;font-size:12px;color:#8A8A8A;border-top:1px solid #E9E9E9;padding-top:16px;">
      You received this email because you registered for an ABTalks workshop with this address.
    </p>
  </div>
</body>
</html>`;

  const text = `Hi ${firstName},

Your registration for the ABTalks workshop is confirmed. Here are the details:

Date: ${webinarDate}
Time: ${webinarTime}
Where: YouTube Live

${joinText}

It is a hands-on session, so join from a laptop if you can.
${whatsappText}
If you can no longer attend, just reply to this email.

Thanks,
The ABTalks team

---
You received this email because you registered for an ABTalks workshop with this address.`;

  const result = await sendEmail({
    to: email,
    toName: name,
    subject: `Your ABTalks workshop registration is confirmed for ${webinarDate}`,
    html,
    text,
    kind: "workshop.confirmation",
  });
  if (!result.ok && !result.skipped) {
    throw new Error(result.reason ?? "workshop confirmation send failed");
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
