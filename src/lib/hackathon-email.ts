import "server-only";
import { BrevoClient } from "@getbrevo/brevo";

const brevoApiKey = process.env.BREVO_API_KEY!;
const fromEmail = process.env.FROM_EMAIL || "team@abtalks.in";
const fromName = process.env.FROM_NAME || "ABTalks";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.abtalks.in";
const logoUrl = `${appUrl}/abtalks-logo.png`;

const brevoClient = new BrevoClient({ apiKey: brevoApiKey });

const WHATSAPP_LINK =
  "https://chat.whatsapp.com/BbF7QWppRjD9KlER4lGYLX?s=cl&p=a&ilr=1";
const SOCIALS = {
  linkedin: "https://www.linkedin.com/company/abtalks-on-ai",
  youtube: "https://youtube.com/@abtalksonai",
  discord: "https://discord.gg/946Ucj6dd",
};

const C = {
  text: "#1f2430",
  muted: "#5b6472",
  soft: "#8a93a2",
  accent: "#6366f1",
  border: "#e6e8ee",
  panel: "#f5f3ff",
};

function eventDetailsBlock(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:12px;margin:20px 0;">
    <tr><td style="padding:20px 22px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.accent};">Event Details</p>
      <p style="margin:0;font-size:14px;line-height:2;color:${C.text};">
        Kick-off: August 7, 8:00 PM IST<br>
        Hackathon Ends: August 9, 8:00 PM IST<br>
        Theme: Artificial Intelligence (all problem statements will be revealed live during the kick-off session)
      </p>
    </td></tr>
  </table>`;
}

function shell(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(20,23,40,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 32px;text-align:center;">
            <img src="${logoUrl}" alt="ABTalks" width="140" style="display:block;margin:0 auto;height:auto;max-width:140px;border:0;outline:none;text-decoration:none;" />
            <p style="color:rgba(255,255,255,0.92);font-size:13px;letter-spacing:0.5px;margin:10px 0 0;">48-Hour AI Hackathon</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:${C.text};font-size:15px;line-height:1.7;">
            ${bodyHtml}
            <p style="margin:26px 0 0;font-size:15px;color:${C.text};">Best regards,<br><strong>Team ABTalks</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fafbfc;padding:22px 32px;text-align:center;border-top:1px solid ${C.border};">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${C.soft};">Follow ABTalks on AI</p>
            <p style="margin:0;font-size:13px;line-height:1.9;color:${C.muted};">
              LinkedIn: <a href="${SOCIALS.linkedin}" style="color:${C.accent};text-decoration:none;">${SOCIALS.linkedin}</a><br>
              YouTube: <a href="${SOCIALS.youtube}" style="color:${C.accent};text-decoration:none;">${SOCIALS.youtube}</a><br>
              Discord: <a href="${SOCIALS.discord}" style="color:${C.accent};text-decoration:none;">${SOCIALS.discord}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 14px;font-size:21px;font-weight:700;color:${C.text};">${text}</h2>`;
}

function sectionTitle(text: string): string {
  return `<p style="margin:22px 0 8px;font-size:15px;font-weight:700;color:${C.text};">${text}</p>`;
}

function whatsappLine(): string {
  return `Join our official ABTalks community: <a href="${WHATSAPP_LINK}" style="color:${C.accent};text-decoration:none;">${WHATSAPP_LINK}</a>`;
}

async function send(
  toEmail: string,
  toName: string,
  subject: string,
  html: string,
): Promise<void> {
  await brevoClient.transactionalEmails.sendTransacEmail({
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent: html,
  });
}

// 1. Solo participant welcome
export async function sendSoloWelcomeEmail(
  name: string,
  email: string,
): Promise<void> {
  const body = `
    ${heading(`Hi ${name},`)}
    <p style="margin:0 0 12px;">You're officially registered for the 48-Hour AI Hackathon!</p>
    <p style="margin:0 0 12px;">Get ready for 48 hours of building, learning, and pushing your creativity with AI.</p>
    ${eventDetailsBlock()}
    ${sectionTitle("You're Participating Solo!")}
    <p style="margin:0 0 12px;">You've registered as a solo participant, so you'll begin the hackathon independently. But don't worry, you'll still have access to mentors, technical support, resources, and a community of builders throughout the event.</p>
    ${sectionTitle("Before the Hackathon")}
    <p style="margin:0 0 6px;">Please complete these quick steps:</p>
    <ul style="margin:0 0 12px;padding-left:20px;">
      <li style="margin-bottom:6px;">Set up your development environment and ensure everything is working.</li>
      <li style="margin-bottom:6px;">${whatsappLine()}</li>
      <li style="margin-bottom:6px;">Keep an eye on your inbox. We'll be sharing important updates, resources, and reminders before the event.</li>
    </ul>
    <p style="margin:0 0 12px;">We're excited to see your ideas come to life. Whether you're building solo or with a team, this is your chance to experiment, learn, and create something incredible!</p>
    <p style="margin:0;">See you at the kick-off!</p>`;
  await send(
    email,
    name,
    "You're registered for the 48-Hour AI Hackathon",
    shell(body),
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
    ${heading(`Hi ${name},`)}
    <p style="margin:0 0 12px;">Your team is officially registered for the 48-Hour AI Hackathon!</p>
    <p style="margin:0 0 12px;">You're all set to lead your team through 48 hours of innovation, collaboration, and AI-powered problem-solving.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:12px;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.accent};">Your Team Details</p>
        <p style="margin:0;font-size:15px;line-height:1.9;color:${C.text};">
          Team Name: <strong>${teamName}</strong><br>
          Team Code: <strong style="letter-spacing:3px;font-family:monospace;">${teamCode}</strong>
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;">Share this Team Code with your teammates. Once they register and enter the code from their dashboard, they'll automatically be added to your team.</p>
    ${eventDetailsBlock()}
    ${sectionTitle("As the Team Leader")}
    <p style="margin:0 0 6px;">Here's what you should do before the hackathon begins:</p>
    <ul style="margin:0 0 12px;padding-left:20px;">
      <li style="margin-bottom:6px;">Share your Team Code with all your teammates so they can join your team.</li>
      <li style="margin-bottom:6px;">Ensure everyone joins the official ABTalks community: <a href="${WHATSAPP_LINK}" style="color:${C.accent};text-decoration:none;">${WHATSAPP_LINK}</a></li>
      <li style="margin-bottom:6px;">You'll receive a notification whenever a new member joins your team.</li>
      <li style="margin-bottom:6px;">Ask your team to set up their development environment, tools, APIs, and required software before the event.</li>
      <li style="margin-bottom:6px;">Keep an eye on your inbox. We'll be sending important updates and reminders leading up to the hackathon.</li>
    </ul>
    ${sectionTitle("Ready to Build?")}
    <p style="margin:0 0 12px;">You're leading the team but every great project starts with great collaboration. Plan ahead, assign responsibilities, and arrive at the kick-off ready to build something amazing.</p>
    <p style="margin:0;">We can't wait to see what your team creates.</p>`;
  await send(
    email,
    name,
    "Your team is registered for the 48-Hour AI Hackathon",
    shell(body),
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
    ${heading(`Hi ${name},`)}
    <p style="margin:0 0 12px;">You're officially registered and have successfully joined a team using the Team Code for the 48-Hour AI Hackathon!</p>
    <p style="margin:0 0 12px;">Your squad is coming together, and you're all set for 48 hours of building, learning, and creating with AI.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:12px;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.accent};">Your Team Details</p>
        <p style="margin:0;font-size:15px;line-height:1.9;color:${C.text};">
          Team Name: <strong>${teamName}</strong><br>
          Team Lead: <strong>${leaderName}</strong>
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;">Your Team Lead will coordinate with the team before and throughout the hackathon, so be sure to stay connected and communicate regularly.</p>
    ${eventDetailsBlock()}
    ${sectionTitle("Before the Hackathon")}
    <p style="margin:0 0 6px;">Please complete these quick steps:</p>
    <ul style="margin:0 0 12px;padding-left:20px;">
      <li style="margin-bottom:6px;">Connect with your Team Lead and fellow teammates.</li>
      <li style="margin-bottom:6px;">${whatsappLine()}</li>
      <li style="margin-bottom:6px;">Set up your development environment, tools, and required software so you're ready to start building from the moment the hackathon begins.</li>
      <li style="margin-bottom:6px;">Keep an eye on your inbox. We'll be sharing important updates, resources, and reminders before the event.</li>
    </ul>
    <p style="margin:0 0 12px;">Everything's set! You've got a team, an idea waiting to happen, and 48 hours to bring it to life.</p>
    <p style="margin:0;">We can't wait to see what you build together.</p>`;
  await send(
    email,
    name,
    "You've joined a team for the 48-Hour AI Hackathon",
    shell(body),
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
    ${heading(`Hi ${leaderName},`)}
    <p style="margin:0 0 12px;">Your team just got bigger!</p>
    <p style="margin:0 0 12px;"><strong>${memberName}</strong> has successfully joined your team using your Team Code.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:12px;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.accent};">Updated Team Details</p>
        <p style="margin:0;font-size:15px;line-height:1.9;color:${C.text};">
          Team Name: <strong>${teamName}</strong><br>
          Team Code: <strong style="letter-spacing:3px;font-family:monospace;">${teamCode}</strong><br>
          New Member: <strong>${memberName}</strong>
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;">Take a moment to welcome your new teammate and get them up to speed on any discussions or planning you've already started.</p>
    ${sectionTitle("Before the Hackathon")}
    <p style="margin:0 0 6px;">To help your team get off to a strong start:</p>
    <ul style="margin:0 0 12px;padding-left:20px;">
      <li style="margin-bottom:6px;">Introduce your new teammate to the rest of the team.</li>
      <li style="margin-bottom:6px;">Make sure everyone has joined the official ABTalks community: <a href="${WHATSAPP_LINK}" style="color:${C.accent};text-decoration:none;">${WHATSAPP_LINK}</a></li>
      <li style="margin-bottom:6px;">Discuss ideas, assign initial roles if you'd like, and ensure everyone has their development environment ready.</li>
      <li style="margin-bottom:6px;">Be ready for the Kick-off on August 7 at 8:00 PM IST, when the problem statements will be revealed.</li>
    </ul>
    <p style="margin:0;">Still have room on your team? Share your Team Code with others before registrations close and complete your squad!</p>`;
  await send(
    leaderEmail,
    leaderName,
    "A new member joined your hackathon team",
    shell(body),
  );
}
