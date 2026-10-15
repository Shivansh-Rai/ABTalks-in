/**
 * Plan 191 — copy for the temporary launch one-pager.
 *
 * Candidate side only. There is deliberately NO /hire, /talent or
 * /recruiter-onboarding link in this file: the recruiter product is hidden
 * while this page is the home page, and middleware redirects those routes to
 * / for everyone but admins, so a link here would be a dead one.
 */

/**
 * When the next Claude Challenge opens, in IST — the zone every challenge day
 * boundary on this platform is measured in (see lib/date-utils).
 *
 * This and CLAUDE_LAUNCH_LABEL are the ONLY two places the date exists. Change
 * them together.
 */
export const CLAUDE_LAUNCH_AT = "2026-11-15T00:00:00+05:30";

/** The same moment, as the page says it out loud. */
export const CLAUDE_LAUNCH_LABEL = "15 November 2026";

export const LAUNCH_HERO = {
  eyebrow: "Next cohort",
  headline: "Another Claude Challenge\nis launching.",
  body: "Sixty days of building with Claude — one scoped task a day, shipped in public, scored against the platform's own checks. Registration opens shortly before kickoff. Join the community below and you'll hear the moment it does.",
  datePrefix: "Starts",
} as const;

export const LAUNCH_POINTS = [
  {
    title: "Build with Claude every day",
    body: "A new task each day for 60 days — prompt engineering, agents and tooling, learned by shipping rather than reading.",
  },
  {
    title: "Proof of work, not promises",
    body: "Every task lands on GitHub and goes up on LinkedIn. At the end you have sixty days of public, dated build history.",
  },
  {
    title: "A verified certificate",
    body: "Finish the track and your certificate is issued against the work the platform actually checked, not a sign-up form.",
  },
] as const;

// No /mission: it sits in middleware's protectedPaths, so that link has always
// led to a login form rather than to the page.
export const LAUNCH_FOOTER_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
] as const;
