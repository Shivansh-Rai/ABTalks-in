import "server-only";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.abtalks.in";

const WHATSAPP_LINK = HACKATHON.whatsappLink;

const C = {
  text: "#353535",
  muted: "#6B6B6B",
  accent: "#03535F",
  border: "#E9E9E9",
};

function eventDetailsBlock(): string {
  return `
    <p style="margin:0 0 6px;font-weight:700;">Event details</p>
    <p style="margin:0 0 16px;">
      Kick-off: August 7, 8:00 PM IST<br>
      Hackathon ends: August 9, 8:00 PM IST<br>
      Theme: Artificial Intelligence (problem statements are revealed live at the kick-off)
    </p>`;
}

/**
 * One plain column of text. These are registration and team updates sent to
 * one person, and Gmail files them by how they look: the old logo banner,
 * shadowed card and "Follow us" social footer read as a newsletter and pushed
 * them to Promotions.
 */
function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:${C.text};font-size:15px;line-height:1.6;">
    ${bodyHtml}
    <p style="margin:24px 0 24px;">Thanks,<br>The ABTalks team</p>
    <p style="margin:0;font-size:12px;color:${C.muted};border-top:1px solid ${C.border};padding-top:16px;">
      You received this email because you registered for the ABTalks 48-Hour AI Hackathon with this address. Questions? Reply to this email.
    </p>
  </div>
</body>
</html>`;
}

function greeting(name: string): string {
  return `<p style="margin:0 0 16px;">Hi ${name},</p>`;
}

function sectionTitle(text: string): string {
  return `<p style="margin:20px 0 6px;font-weight:700;">${text}</p>`;
}

function link(href: string, label = href): string {
  return `<a href="${href}" style="color:${C.accent};">${label}</a>`;
}

function whatsappLine(): string {
  return `Join the ABTalks hackathon WhatsApp group: ${link(WHATSAPP_LINK)}`;
}

/**
 * Plain-text alternative. These messages used to go out as HTML only, which
 * mailbox providers score as more spam-like — a plausible reason a registrant
 * finds nothing in their inbox even when Brevo reports the send as accepted.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_m, href: string, label: string) =>
      label === href ? href : `${label} (${href})`,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * All hackathon mail goes through the shared Brevo transport rather than a
 * second client built here. That one logs a missing `BREVO_API_KEY`, skips
 * seed addresses, sets a Reply-To and returns a result instead of throwing —
 * so a send that does not happen says so in the logs, which is exactly what
 * this path was missing when registrants reported no welcome email.
 */
async function send(
  toEmail: string,
  toName: string,
  subject: string,
  bodyHtml: string,
): Promise<void> {
  const html = shell(subject, bodyHtml);
  const result = await sendEmail({
    to: toEmail,
    toName,
    subject,
    html,
    text: toPlainText(html),
    kind: "hackathon.transactional",
  });
  if (!result.ok) {
    // The recipient address and name used to be in this line. `deliveryId` is
    // what identifies the send now: it is on the OutboundDelivery row
    // (which holds the address hash) and on the Sentry event.
    logger.error(
      {
        event: "hackathon.email.not_delivered",
        deliveryId: result.deliveryId,
        skipped: result.skipped === true,
        reason: result.reason,
      },
      "hackathon email not delivered",
    );
  }
}

// 1. Solo participant welcome
export async function sendSoloWelcomeEmail(
  name: string,
  email: string,
): Promise<void> {
  const body = `
    ${greeting(name)}
    <p style="margin:0 0 16px;">Your registration for the ABTalks 48-Hour AI Hackathon is confirmed. You are taking part as a solo participant.</p>
    ${eventDetailsBlock()}
    <p style="margin:0 0 16px;">As a solo participant you still have access to mentors, technical support and resources throughout the event.</p>
    ${sectionTitle("Before the hackathon")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;">Set up your development environment and check that everything works.</li>
      <li style="margin-bottom:6px;">${whatsappLine()}</li>
      <li style="margin-bottom:6px;">Watch this inbox for updates and reminders before the event.</li>
    </ul>
    <p style="margin:0;">See you at the kick-off.</p>`;
  await send(
    email,
    name,
    "Your ABTalks hackathon registration is confirmed",
    body,
  );
}

// 2. Team leader welcome (with team name + code)
export async function sendLeaderWelcomeEmail(
  name: string,
  email: string,
  teamName: string,
  teamCode: string,
): Promise<void> {
  const body = `
    ${greeting(name)}
    <p style="margin:0 0 16px;">Your team is registered for the ABTalks 48-Hour AI Hackathon, with you as team leader.</p>
    <p style="margin:0 0 6px;font-weight:700;">Your team</p>
    <p style="margin:0 0 16px;">
      Team name: <strong>${teamName}</strong><br>
      Team code: <strong style="letter-spacing:2px;font-family:Menlo,Consolas,monospace;">${teamCode}</strong>
    </p>
    <p style="margin:0 0 16px;">Share the team code with your teammates. When they register and enter it on their dashboard, they are added to your team, and we will email you each time someone joins.</p>
    ${eventDetailsBlock()}
    ${sectionTitle("Before the hackathon")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;">Send the team code to everyone on your team.</li>
      <li style="margin-bottom:6px;">Make sure everyone joins the hackathon WhatsApp group: ${link(WHATSAPP_LINK)}</li>
      <li style="margin-bottom:6px;">Ask your team to set up their development environment, tools and APIs before the event.</li>
      <li style="margin-bottom:6px;">Watch this inbox for updates and reminders before the event.</li>
    </ul>
    <p style="margin:0;">See you at the kick-off.</p>`;
  await send(
    email,
    name,
    `Your team ${teamName} is registered for the ABTalks hackathon`,
    body,
  );
}

// 3. Team member welcome (with team name + leader name)
export async function sendMemberWelcomeEmail(
  name: string,
  email: string,
  teamName: string,
  leaderName: string,
): Promise<void> {
  const body = `
    ${greeting(name)}
    <p style="margin:0 0 16px;">Your registration for the ABTalks 48-Hour AI Hackathon is confirmed, and you have joined a team using its team code.</p>
    <p style="margin:0 0 6px;font-weight:700;">Your team</p>
    <p style="margin:0 0 16px;">
      Team name: <strong>${teamName}</strong><br>
      Team leader: <strong>${leaderName}</strong>
    </p>
    <p style="margin:0 0 16px;">Your team leader coordinates the team before and during the hackathon, so stay in touch with them.</p>
    ${eventDetailsBlock()}
    ${sectionTitle("Before the hackathon")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;">Connect with your team leader and teammates.</li>
      <li style="margin-bottom:6px;">${whatsappLine()}</li>
      <li style="margin-bottom:6px;">Set up your development environment and tools so you can start building at the kick-off.</li>
      <li style="margin-bottom:6px;">Watch this inbox for updates and reminders before the event.</li>
    </ul>
    <p style="margin:0;">See you at the kick-off.</p>`;
  await send(
    email,
    name,
    `You have joined team ${teamName} for the ABTalks hackathon`,
    body,
  );
}

// 4. Notify team leader that a new member joined
export async function sendLeaderNewMemberEmail(
  leaderName: string,
  leaderEmail: string,
  memberName: string,
  teamName: string,
  teamCode: string,
): Promise<void> {
  const body = `
    ${greeting(leaderName)}
    <p style="margin:0 0 16px;"><strong>${memberName}</strong> has joined your team using your team code.</p>
    <p style="margin:0 0 6px;font-weight:700;">Your team</p>
    <p style="margin:0 0 16px;">
      Team name: <strong>${teamName}</strong><br>
      Team code: <strong style="letter-spacing:2px;font-family:Menlo,Consolas,monospace;">${teamCode}</strong><br>
      New member: <strong>${memberName}</strong>
    </p>
    ${sectionTitle("Next steps")}
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="margin-bottom:6px;">Introduce ${memberName} to the rest of the team and share any plans you have already made.</li>
      <li style="margin-bottom:6px;">Make sure everyone has joined the hackathon WhatsApp group: ${link(WHATSAPP_LINK)}</li>
      <li style="margin-bottom:6px;">Be ready for the kick-off on August 7 at 8:00 PM IST, when the problem statements are revealed.</li>
    </ul>
    <p style="margin:0;">If your team still has open spots, you can share the team code with others until registration closes.</p>`;
  await send(
    leaderEmail,
    leaderName,
    `${memberName} joined your hackathon team ${teamName}`,
    body,
  );
}

// 5. Notify a member that they were removed from a team
export async function sendMemberRemovedEmail(
  name: string,
  email: string,
  teamName: string | null,
): Promise<void> {
  const teamLabel = teamName ?? "your previous team";
  const body = `
    ${greeting(name)}
    <p style="margin:0 0 16px;">You have been removed from <strong>${teamLabel}</strong> in the ABTalks 48-Hour AI Hackathon.</p>
    <p style="margin:0 0 16px;">You can register again at any time: on your own, as a new team, or by joining a team with its team code (including the same code, if your leader invites you back).</p>
    <p style="margin:0;">Register again: ${link(`${appUrl}/hackathon`)}</p>`;
  await send(
    email,
    name,
    "You were removed from your ABTalks hackathon team",
    body,
  );
}

// 6. Confirm to the leader that a member was removed
export async function sendLeaderMemberRemovedEmail(
  leaderName: string,
  leaderEmail: string,
  memberName: string,
  teamName: string | null,
  teamCode: string,
  spotsLeft: number,
): Promise<void> {
  const teamLabel = teamName ?? "your team";
  const spotLabel =
    spotsLeft === 1 ? "1 spot left" : `${spotsLeft} spots left`;
  const body = `
    ${greeting(leaderName)}
    <p style="margin:0 0 16px;"><strong>${memberName}</strong> has been removed from <strong>${teamLabel}</strong>.</p>
    <p style="margin:0 0 6px;font-weight:700;">Your team</p>
    <p style="margin:0 0 16px;">
      Team name: <strong>${teamLabel}</strong><br>
      Team code: <strong style="letter-spacing:2px;font-family:Menlo,Consolas,monospace;">${teamCode}</strong><br>
      Open spots: <strong>${spotLabel}</strong>
    </p>
    <p style="margin:0;">To fill the spot, share your team code with someone else, or with ${memberName} again if you change your mind.</p>`;
  await send(
    leaderEmail,
    leaderName,
    `${memberName} was removed from your hackathon team`,
    body,
  );
}
