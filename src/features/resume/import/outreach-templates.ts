import type { Completeness, CompletenessKey, OutreachTemplate } from "@/features/resume/import/outreach-steps";

/**
 * The four claim-and-complete emails (plan 171). Pure: data in, `{ subject,
 * html, text }` out.
 *
 * One layout, the ABTalks profile design approved for the first email. The
 * invite is that design word for word, with only these changes:
 *   - the greeting row says "Hi {firstName},"
 *   - "What's missing" lists the person's real gaps (no ticks) under their
 *     completeness %
 *   - the button is their own claim link, "Claim my profile →"
 *   - a line under the button names the email to sign in with
 *   - no Unsubscribe link in the footer
 * The other three emails reuse the layout with their own words.
 *
 * Every value that came from a résumé is escaped. No figure appears except
 * the completeness %.
 */

export type OutreachEmailData = {
  firstName: string;
  /** The address the person must sign in with (the résumé's email). */
  email: string;
  /** `https://…/claim/<token>` — the invite and invite reminder button. */
  claimUrl: string;
  /** `https://…/profile` — the onboarding button. */
  profileUrl: string;
  completeness: Completeness;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const PREFERENCES_URL =
  "http://abtalks.in/?utm_source=brevo&utm_medium=email&utm_campaign=ABT-Profile_copy";

/**
 * Every attribute in the layout is double-quoted, so `'` needs no escaping —
 * and leaving it alone keeps the approved copy ("You're", "Don't") exact.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MISSING_COPY: Record<CompletenessKey, { title: string; detail: string }> = {
  phone: {
    title: "Phone number",
    detail: "Verify your phone so opportunities can reach you.",
  },
  education: {
    title: "Education",
    detail: "Add where you studied and when you graduate.",
  },
  experience: {
    title: "Experience & projects",
    detail: "Show the work you've done, not just the title you hold.",
  },
  skills: {
    title: "Skills & expertise",
    detail: "Help recruiters understand what you can actually do.",
  },
  links: {
    title: "GitHub or LinkedIn",
    detail: "Give your profile enough context to stand on its own.",
  },
};

type Layout = {
  title: string;
  greeting: string;
  hero: string[];
  body: string;
  cardTitle: string;
  cardText: string;
  completeness: Completeness;
  ctaHref: string;
  ctaLabel: string;
  /** Extra line under "Takes only a few minutes." (already escaped HTML). */
  ctaNoteHtml: string | null;
  closingTitle: string;
  closingBody: string;
};

function missingRowsHtml(c: Completeness): string {
  if (c.missing.length === 0) {
    return `
        <tr>
          <td width="22" valign="top" style="font-size:14px;color:#006875;font-weight:900;">+</td>
          <td style="font-size:12px;line-height:17px;color:#444;">
            <strong>Nothing major is missing</strong><br>
            Review what's there and make it yours.
          </td>
        </tr>`;
  }
  return c.missing
    .map((key, i) => {
      const last = i === c.missing.length - 1;
      const pad = last ? "" : "padding-bottom:8px;";
      const item = MISSING_COPY[key];
      return `
        <tr>
          <td width="22" valign="top" style="font-size:14px;color:#006875;font-weight:900;${pad}">+</td>
          <td style="font-size:12px;line-height:17px;color:#444;${pad}">
            <strong>${escapeHtml(item.title)}</strong><br>
            ${escapeHtml(item.detail)}
          </td>
        </tr>`;
    })
    .join("\n");
}

function layoutHtml(l: Layout): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(l.title)}</title>
<style>
  body{margin:0;padding:0;background:#f2f3f3;font-family:Arial,Helvetica,sans-serif;color:#111}
  table{border-collapse:collapse}
  a{text-decoration:none}
  .wrap{width:100%;padding:18px 0}
  .card{width:600px;max-width:600px;background:#fff;border-radius:8px;overflow:hidden}
  .pad{padding-left:40px;padding-right:40px}
  .logo{font-size:21px;font-weight:900;letter-spacing:-1.5px}
  .eyebrow{display:inline-block;background:#e8f4f5;color:#006875;border-radius:20px;padding:6px 10px;font-size:9px;font-weight:800;letter-spacing:.5px}
  .hero{font-size:30px;line-height:32px;font-weight:900;letter-spacing:-1px}
  .body{font-size:13px;line-height:19px;color:#555}
  .teal-card{background:#006875;color:#fff;border-radius:8px}
  .section-title{font-size:12px;line-height:16px;font-weight:900;color:#006875;letter-spacing:.8px;text-transform:uppercase}
  .profile-title{font-size:20px;line-height:22px;font-weight:900;color:#006875}
  .small{font-size:10px;line-height:15px;color:#555}
  .button{display:inline-block;background:#006875;color:#fff;padding:10px 15px;border-radius:6px;font-size:11px;font-weight:800}
  .line{height:1px;background:#dfe5e5}
  @media only screen and (max-width:620px){
    .card{width:100%!important}
    .pad{padding-left:24px!important;padding-right:24px!important}
    .hero{font-size:27px!important;line-height:30px!important}
  }
</style>
</head>

<body>
<table width="100%" role="presentation" class="wrap">
<tr><td align="center">

<table class="card" role="presentation" width="600">

  <!-- Header -->
  <tr>
    <td class="pad" style="padding-top:22px;padding-bottom:18px;">
      <div class="logo">AB TALKS</div>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td class="pad" style="padding-bottom:12px;">
      <div style="font-size:10px;line-height:15px;color:#555;">
        ${escapeHtml(l.greeting)}
      </div>
    </td>
  </tr>

  <!-- Hero -->
  <tr>
    <td class="pad" style="padding-bottom:10px;">
      <div class="eyebrow">YOUR PROFILE · AB TALKS</div>
    </td>
  </tr>

  <tr>
    <td class="pad" style="padding-bottom:12px;">
      <div class="hero">
        ${l.hero.map(escapeHtml).join("<br>\n        ")}
      </div>
    </td>
  </tr>

  <tr>
    <td class="pad" style="padding-bottom:18px;">
      <div class="body">
        ${escapeHtml(l.body)}
      </div>
    </td>
  </tr>

  <!-- Profile card -->
  <tr>
    <td class="pad" style="padding-bottom:22px;">
      <table width="100%" role="presentation" class="teal-card">
        <tr>
          <td style="padding:18px 20px 17px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:.7px;margin-bottom:7px;">
              YOUR AB TALKS PROFILE
            </div>

            <div style="font-size:22px;line-height:25px;font-weight:900;margin-bottom:8px;">
              ${escapeHtml(l.cardTitle)}
            </div>

            <div style="font-size:10px;line-height:15px;color:#dceff0;">
              ${escapeHtml(l.cardText)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- What is missing -->
  <tr>
    <td class="pad" style="padding-bottom:8px;">
      <div class="section-title">WHAT'S MISSING</div>
      <div style="font-size:12px;line-height:17px;color:#444;margin-top:4px;">
        Your profile is <strong>${l.completeness.percent}%</strong> complete.
      </div>
    </td>
  </tr>

  <tr>
    <td class="pad" style="padding-bottom:18px;">
      <table width="100%" role="presentation">
${missingRowsHtml(l.completeness)}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td class="pad" style="padding-bottom:24px;">
      <a href="${escapeHtml(l.ctaHref)}" class="button">${escapeHtml(l.ctaLabel)}</a>
      <div style="font-size:9px;line-height:14px;color:#888;margin-top:7px;">
        Takes only a few minutes.
      </div>${
        l.ctaNoteHtml
          ? `
      <div style="font-size:9px;line-height:14px;color:#888;margin-top:3px;">
        ${l.ctaNoteHtml}
      </div>`
          : ""
      }
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td class="pad" style="padding-bottom:20px;">
      <div class="line"></div>
    </td>
  </tr>

  <!-- Why complete -->
  <tr>
    <td class="pad" style="padding-bottom:8px;">
      <div style="font-size:17px;line-height:21px;font-weight:900;">
        ${escapeHtml(l.closingTitle)}
      </div>
    </td>
  </tr>

  <tr>
    <td class="pad" style="padding-bottom:20px;">
      <div class="body">
        ${escapeHtml(l.closingBody)}
      </div>
    </td>
  </tr>

  <!-- Final teal strip -->
  <tr>
    <td class="pad" style="padding-bottom:22px;">
      <table width="100%" role="presentation" style="background:#edf6f6;border:1px solid #cde5e7;border-radius:7px;">
        <tr>
          <td style="padding:13px 15px;">
            <div style="font-size:11px;line-height:16px;font-weight:800;color:#006875;">
              Your profile. Your skills. Your next opportunity.
            </div>
            <div style="font-size:10px;line-height:15px;color:#555;margin-top:3px;">
              Review what’s there and add what’s missing.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Signoff -->
  <tr>
    <td class="pad" style="padding-bottom:25px;">
      <div style="font-size:10px;line-height:15px;color:#555;">
        Thanks,<br>
        <strong style="color:#111;">Team ABTALKS</strong>
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f7f9f9;border-top:1px solid #e1e7e7;padding:13px 20px;text-align:center;">
      <div style="font-size:8px;line-height:13px;letter-spacing:1.3px;color:#617174;">
        AB TALKS &nbsp;·&nbsp; LEARN &nbsp;·&nbsp; BUILD &nbsp;·&nbsp; GROW
      </div>
      <div style="font-size:8px;line-height:13px;color:#999;margin-top:5px;">
        <a href="${PREFERENCES_URL}" style="color:#777;">Preferences</a>
      </div>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

function missingText(c: Completeness): string {
  if (c.missing.length === 0) return "- Nothing major is missing. Review what's there and make it yours.";
  return c.missing.map((k) => `- ${MISSING_COPY[k].title}: ${MISSING_COPY[k].detail}`).join("\n");
}

function layoutText(l: Layout, ctaNoteText: string | null): string {
  return [
    "AB TALKS",
    "",
    l.greeting,
    "",
    l.hero.join(" "),
    "",
    l.body,
    "",
    `${l.cardTitle} ${l.cardText}`,
    "",
    `WHAT'S MISSING — your profile is ${l.completeness.percent}% complete.`,
    missingText(l.completeness),
    "",
    `${l.ctaLabel.replace(/\s*→$/, "")}: ${l.ctaHref}`,
    "Takes only a few minutes.",
    ...(ctaNoteText ? [ctaNoteText] : []),
    "",
    l.closingTitle,
    l.closingBody,
    "",
    "Thanks,",
    "Team ABTALKS",
  ].join("\n");
}

function signInNote(email: string): { html: string; text: string } {
  return {
    html: `Sign in with <strong>${escapeHtml(email)}</strong> to claim it.`,
    text: `Sign in with ${email} to claim it.`,
  };
}

export function renderOutreachEmail(template: OutreachTemplate, d: OutreachEmailData): RenderedEmail {
  const greeting = `Hi ${d.firstName.trim() || "there"},`;
  const common = {
    greeting,
    completeness: d.completeness,
    closingTitle: "Don't let an incomplete profile speak for you.",
    closingBody:
      "A complete profile gives opportunities a better picture of your skills, background and interests across AB TALKS.",
  };

  let layout: Layout;
  let noteText: string | null = null;

  switch (template) {
    case "invite": {
      const note = signInNote(d.email);
      noteText = note.text;
      layout = {
        ...common,
        title: "Someone looking at your profile would miss this.",
        hero: ["Someone looking at your profile", "would miss this."],
        body:
          "Your AB TALKS profile is already taking shape. But a few important details are still missing, which means someone discovering your profile may not get the complete picture of what you can do.",
        cardTitle: "You're closer than you think.",
        cardText: "Complete your profile to make your skills, experience and interests easier to understand.",
        ctaHref: d.claimUrl,
        ctaLabel: "Claim my profile →",
        ctaNoteHtml: note.html,
      };
      break;
    }
    case "invite_reminder": {
      const note = signInNote(d.email);
      noteText = note.text;
      layout = {
        ...common,
        title: "Your AB TALKS profile is still waiting.",
        hero: ["Your profile is", "still waiting."],
        body:
          "Your AB TALKS profile is ready for you to claim. Claim it to review what's there, add what's missing and make it yours.",
        cardTitle: "One step to make it yours.",
        cardText: "Claim your profile, then fill in the few details that are still missing.",
        ctaHref: d.claimUrl,
        ctaLabel: "Claim my profile →",
        ctaNoteHtml: note.html,
      };
      break;
    }
    case "onboard_welcome": {
      layout = {
        ...common,
        title: "You're in. Here's what's left on your profile.",
        hero: ["You're in.", "Here's what's left."],
        body:
          "Your AB TALKS profile is now yours. A few details are still missing — add them so anyone discovering your profile gets the complete picture.",
        cardTitle: "You're closer than you think.",
        cardText: "Complete your profile to make your skills, experience and interests easier to understand.",
        ctaHref: d.profileUrl,
        ctaLabel: "Complete my profile →",
        ctaNoteHtml: null,
      };
      break;
    }
    case "onboard_reminder": {
      const first = d.completeness.missing[0];
      const focus = first ? MISSING_COPY[first].title : "your details";
      layout = {
        ...common,
        title: "One thing left on your AB TALKS profile.",
        hero: ["One thing left", "to stand out."],
        body: `Your profile is ${d.completeness.percent}% complete. The most useful thing to add next: ${focus}.`,
        cardTitle: "Almost there.",
        cardText: "A complete profile is easier to understand at a glance.",
        ctaHref: d.profileUrl,
        ctaLabel: "Complete my profile →",
        ctaNoteHtml: null,
      };
      break;
    }
  }

  return {
    subject: subjectFor(template, d),
    html: layoutHtml(layout),
    text: layoutText(layout, noteText),
  };
}

/**
 * Subject lines written as personal account notices, not campaigns: the
 * person's name first, plain words, no exclamation marks, emoji, capitals or
 * offer language — the cues Gmail's Promotions classifier picks up. The
 * sending side already matches (one-to-one, no `Precedence: bulk`, no
 * `List-Unsubscribe`). The visible `<title>` / body copy is unchanged.
 */
function subjectFor(template: OutreachTemplate, d: OutreachEmailData): string {
  const name = d.firstName.trim();
  const lead = (withName: string, without: string) => (name ? `${name}, ${withName}` : without);
  switch (template) {
    case "invite":
      return lead("your ABTalks profile is ready to claim", "Your ABTalks profile is ready to claim");
    case "invite_reminder":
      return lead(
        "your ABTalks profile is still waiting for you",
        "Your ABTalks profile is still waiting for you",
      );
    case "onboard_welcome":
      return lead("you've claimed your ABTalks profile", "You've claimed your ABTalks profile");
    case "onboard_reminder": {
      const first = d.completeness.missing[0];
      const focus = first ? MISSING_COPY[first].title.toLowerCase() : "a few details";
      return lead(
        `one detail left on your ABTalks profile: ${focus}`,
        `One detail left on your ABTalks profile: ${focus}`,
      );
    }
  }
}
