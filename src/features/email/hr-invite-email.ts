import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.klymb.ai";

/**
 * Plan 194 — the mail that carries an HR's sign-in link.
 *
 * Deliberately plain and short. It is a credential in an inbox, so it says
 * what it opens, how long it lasts, and that it is for one person; it does not
 * try to sell anything around that.
 */
export async function sendHrInviteEmail(input: {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
}): Promise<SendEmailResult> {
  const url = `${APP_URL}/hr/signin?t=${encodeURIComponent(input.token)}`;
  const expires = input.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const firstName = input.name.trim().split(/\s+/)[0] || "there";

  const text = [
    `Hi ${firstName},`,
    "",
    "Your recruiter workspace on Klymb AI is ready. Open this link to sign in — no password needed:",
    "",
    url,
    "",
    `The link works once and expires on ${expires}. It signs in to your own workspace, so please don't forward it; if a colleague needs access, reply and we'll send them their own.`,
    "",
    "— Klymb AI",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:24px;color:#1f2937;max-width:520px">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Your recruiter workspace on Klymb AI is ready. Open this link to sign in — no password needed:</p>
      <p style="margin:28px 0">
        <a href="${url}" style="background:#03535F;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Open my workspace</a>
      </p>
      <p style="color:#4b5563;font-size:13px">
        The link works once and expires on ${escapeHtml(expires)}. It signs in to
        your own workspace, so please don't forward it — if a colleague needs
        access, reply and we'll send them their own.
      </p>
      <p style="color:#6b7280;font-size:13px">— Klymb AI</p>
    </div>
  `;

  return sendEmail({
    to: input.to,
    toName: input.name,
    subject: "Your Klymb AI recruiter workspace",
    html,
    text,
    kind: "hire.hr_invite",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
