import "server-only";
import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "@/lib/logger";

const DASHBOARD_LABEL = "Login to Dashboard";

const SOCIALS: { href: string; src: string; alt: string }[] = [
  {
    href: "https://www.linkedin.com/company/abtalks-on-ai",
    src: "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/linkedin_32px.png",
    alt: "LinkedIn",
  },
  {
    href: "https://youtube.com/@abtalksonai",
    src: "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/youtube_32px.png",
    alt: "YouTube",
  },
  {
    href: "https://discord.gg/946Ucj6dd",
    src: "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/discord_32px.png",
    alt: "Discord",
  },
  {
    href: "https://chat.whatsapp.com/Fqx07wwZhiq0lA6Z7d5uad",
    src: "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/whatsapp_32px.png",
    alt: "WhatsApp",
  },
  {
    href: "https://www.instagram.com/abtalks_official",
    src: "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/instagram_32px.png",
    alt: "Instagram",
  },
];

export function challengeResetEmail(input: {
  firstName: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { firstName, dashboardUrl } = input;
  const subject = "Update: Your Challenge Reset Request Has Been Approved";

  const text = `Hello ${firstName},

Thank you for submitting your Challenge Reset Request.

We have reviewed your request and are pleased to inform you that your challenge progress has been successfully reset. You may now restart the ABTalks 60-Day Claude AI Challenge from Day 1.

A fresh start is a valuable opportunity to rebuild momentum, strengthen your consistency, and get the most out of the challenge experience.

Please note: To continue your participation, you must complete and submit the Day 1 task before 12:00 AM (midnight) today.

We encourage you to stay committed, maintain your daily streak, and keep moving forward one day at a time.

We look forward to supporting your journey and seeing your progress throughout the challenge.

Best regards,
Team ABTalks

Login to your dashboard: ${dashboardUrl}`;

  const socialCells = SOCIALS.map(
    (s) =>
      `<td style="padding:0 6px;"><a href="${s.href}" target="_blank"><img src="${s.src}" alt="${s.alt}" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;"></a></td>`,
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f9f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#e16213,#e84393);padding:24px 32px;text-align:center;">
              <span style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:1px;">AB TALKS</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3b3f44;">
              <h3 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F2D3D;">Hello <strong>${firstName}</strong>,</h3>
              <p style="margin:0 0 16px;">Thank you for submitting your Challenge Reset Request.</p>
              <p style="margin:0 0 16px;">We have reviewed your request and are pleased to inform you that your challenge progress has been successfully reset. You may now restart the <strong>ABTalks 60-Day Claude AI Challenge</strong> from <strong>Day 1</strong>.</p>
              <p style="margin:0 0 16px;">A fresh start is a valuable opportunity to rebuild momentum, strengthen your consistency, and get the most out of the challenge experience.</p>
              <p style="margin:0 0 16px;"><strong>Please note:</strong> To continue your participation, you must complete and submit the <strong>Day 1 task before 12:00 AM (midnight) today.</strong></p>
              <p style="margin:0 0 16px;">We encourage you to stay committed, maintain your daily streak, and keep moving forward one day at a time.</p>
              <p style="margin:0 0 24px;">We look forward to supporting your journey and seeing your progress throughout the challenge.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#000000;border-radius:11px;">
                    <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:12px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${DASHBOARD_LABEL}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;">Best regards,</p>
              <p style="margin:0 0 24px;">Team ABTalks</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                <tr>${socialCells}</tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Sends the challenge-reset confirmation via Brevo (the same provider used by
 * the workshop flow). Best-effort: never throws — logs and returns on failure
 * so it can't break the admin reset it's called from.
 */
export async function sendChallengeResetEmail(input: {
  to: string;
  firstName: string;
  dashboardUrl: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    logger.warn("[challenge-reset-email] BREVO_API_KEY missing — skipping send");
    return;
  }
  // Never email seed/test accounts (avoid bounces hurting domain reputation).
  if (input.to.toLowerCase().endsWith("@abtalks.dev")) {
    logger.info("[challenge-reset-email] skipping test address");
    return;
  }

  const fromEmail = process.env.FROM_EMAIL || "team@abtalks.in";
  const fromName = process.env.FROM_NAME || "ABTalks";
  const { subject, html, text } = challengeResetEmail({
    firstName: input.firstName,
    dashboardUrl: input.dashboardUrl,
  });

  try {
    const brevoClient = new BrevoClient({ apiKey });
    await brevoClient.transactionalEmails.sendTransacEmail({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: input.to, name: input.firstName }],
      subject,
      htmlContent: html,
      textContent: text,
    });
  } catch (e) {
    logger.error("[challenge-reset-email] send failed", { error: String(e) });
  }
}
