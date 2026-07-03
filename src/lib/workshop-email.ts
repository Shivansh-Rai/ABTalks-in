import { BrevoClient } from "@getbrevo/brevo";

const brevoApiKey = process.env.BREVO_API_KEY!;
const fromEmail = process.env.FROM_EMAIL || "team@abtalks.in";
const fromName = process.env.FROM_NAME || "ABTalks";

const brevoClient = new BrevoClient({ apiKey: brevoApiKey });

export async function sendWorkshopConfirmationEmail(
  name: string,
  email: string,
  config: { zoomLink: string; whatsappLink: string; webinarDate: string; webinarTime: string }
): Promise<void> {
  const { zoomLink, whatsappLink, webinarDate, webinarTime } = config;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#e16213,#e84393);padding:32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:1px;">AB TALKS</h1>
              <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:8px 0 0;">AI Workshop</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 8px;">🎉 You're Registered!</h2>
              <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Hi <strong>${name}</strong>,<br><br>
                Thank you for registering for the <strong>ABTalks AI Bootcamp</strong>. Your registration has been confirmed.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef7f0;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:24px;">
                  <h3 style="color:#e16213;font-size:16px;margin:0 0 16px;">Your Webinar Details</h3>
                  <p style="color:#333;font-size:14px;line-height:2;margin:0;">
                    📅 <strong>Date:</strong> ${webinarDate}<br>
                    🕒 <strong>Time:</strong> ${webinarTime}<br>
                    📍 <strong>Platform:</strong> Google Meet
                  </p>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${zoomLink}" style="display:inline-block;background:linear-gradient(135deg,#e16213,#e84393);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:50px;font-size:15px;font-weight:600;">
                      🔗 Join Google Meet
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 16px;">
                Please join the meeting 5–10 minutes before the session starts.
              </p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Also join our <a href="${whatsappLink}" style="color:#e16213;font-weight:600;">WhatsApp Community</a> for reminders, announcements, and future workshops.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa;padding:24px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#999;font-size:13px;margin:0;">Looking forward to seeing you!</p>
              <p style="color:#666;font-size:14px;font-weight:600;margin:8px 0 0;">Team ABTalks</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await brevoClient.transactionalEmails.sendTransacEmail({
    sender: { name: fromName, email: fromEmail },
    to: [{ email, name }],
    subject: "🎉 You're Registered for the FREE AI Bootcamp!",
    htmlContent: html,
  });
}
