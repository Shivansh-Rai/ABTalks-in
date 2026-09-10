const WHATSAPP_URL = "https://chat.whatsapp.com/LSru1BgvifpEB4OMZsaZEi";

const LINK_STYLE = "color:#03535F;text-decoration:underline;";

export function claudeWelcomeEmail(input: {
  fullName: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const dashboardUrl = `${input.appUrl}/dashboard`;
  const subject = `Welcome to ABTalks, ${input.fullName} — let's get you started`;

  const text = `Hi ${input.fullName},

Welcome to ABTalks, and congratulations on joining the 60-Day Claude AI Challenge.

Over the next 60 days you'll work hands-on with AI, build real projects, and document your work in public. Everything you need to begin GitHub setup, posting guidelines, submission criteria, and how standout participants are recognised is in the attached Challenge Guidelines. Please read it carefully before you start; following it is essential for your work to count.

But the 60 days are only the beginning. ABTalks isn't a challenge you finish—it's a community you join. Alongside you are job seekers building their portfolios, founders building companies, and investors looking for exactly the kind of talent that ships in public. The real goal is to build this network together, for the long run.

Here's where to start:

Dashboard: ${dashboardUrl}
WhatsApp community (your most important step): ${WHATSAPP_URL}

We look forward to seeing what you build and to having you with us long after Day 60.

Best regards,
Anil Bajpai
Founder, ABTalks`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#353535;margin:0;padding:16px;">
  <p style="margin:0 0 16px;">Hi ${input.fullName},</p>
  <p style="margin:0 0 16px;">Welcome to ABTalks, and congratulations on joining the 60-Day Claude AI Challenge.</p>
  <p style="margin:0 0 16px;">Over the next 60 days you'll work hands-on with AI, build real projects, and document your work in public. Everything you need to begin GitHub setup, posting guidelines, submission criteria, and how standout participants are recognised is in the attached Challenge Guidelines. Please read it carefully before you start; following it is essential for your work to count.</p>
  <p style="margin:0 0 16px;">But the 60 days are only the beginning. ABTalks isn't a challenge you finish—it's a community you join. Alongside you are job seekers building their portfolios, founders building companies, and investors looking for exactly the kind of talent that ships in public. The real goal is to build this network together, for the long run.</p>
  <p style="margin:0 0 8px;">Here's where to start:</p>
  <p style="margin:0 0 4px;">Dashboard: <a href="${dashboardUrl}" style="${LINK_STYLE}">${dashboardUrl}</a></p>
  <p style="margin:0 0 16px;">WhatsApp community (your most important step): <a href="${WHATSAPP_URL}" style="${LINK_STYLE}">${WHATSAPP_URL}</a></p>
  <p style="margin:0 0 16px;">We look forward to seeing what you build and to having you with us long after Day 60.</p>
  <p style="margin:0 0 16px;">Best regards,<br>Anil Bajpai<br>Founder, ABTalks</p>
</body>
</html>`;

  return { subject, html, text };
}
