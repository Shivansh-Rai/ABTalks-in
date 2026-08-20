/**
 * Pure content for the modernist homepage, split out of landing-page.tsx so
 * it can be imported without pulling in "./landing.css" — a plain CSS import
 * that only Next.js's bundler can resolve, not a standalone Node/tsx script
 * (e.g. the knowledge-base extraction pipeline, scripts/extract-public-content.ts).
 */

export const STATS = [
  { figure: "10k", label: "People on the platform" },
  { figure: "100+", label: "Companies in the recruiter network" },
  { figure: "0", label: "Profiles shared without consent" },
];

export const CANDIDATE_ITEMS = [
  "Hackathons — weekend builds, judged and archived",
  "Cohorts — multi-week programs with mentors",
  "Challenges — scoped problems from real companies",
];

export const COMPANY_ITEMS = [
  "Browse candidates by what they shipped",
  "Send us the role and the skills you need",
  "We build a cohort against that requirement",
];

export const STEPS = [
  {
    number: "01",
    title: "A requirement comes in",
    body: "A company tells us the role, the stack, the level and the timeline. If a matching cohort is already running, we point at it. If not, we design one around the requirement.",
  },
  {
    number: "02",
    title: "People build in the open",
    body: "Candidates enter a hackathon, cohort or challenge. Work is submitted, reviewed by mentors and scored against a published rubric — the same rubric for everyone in the room.",
  },
  {
    number: "03",
    title: "The candidate releases the profile",
    body: "We show the company the evidence without the identity. When there is genuine interest on both sides, the candidate approves the release and the conversation starts — already past the screening stage.",
  },
];

export const EVIDENCE = [
  {
    title: "Submitted work",
    body: "Repositories, demos and write-ups, timestamped to the event they were built in.",
  },
  {
    title: "Rubric scores",
    body: "How the work was judged, on criteria published before the event started.",
  },
  {
    title: "Mentor review",
    body: "Written notes from the people who watched the work happen, not a reference call.",
  },
  {
    title: "Team signal",
    body: "How they worked with others under a deadline — collaboration, scoped honestly.",
  },
];

export const PROGRAMS = [
  {
    tag: "Hackathon",
    tagClass: "tag tag-accent",
    title: "48-hour build weekend",
    body: "Ship something end-to-end with a team you meet on Friday night. Judged Sunday, archived to your profile.",
    cadence: "Opens monthly · applications open",
    href: "/hackathon",
  },
  {
    tag: "Cohort",
    tagClass: "tag tag-outline",
    title: "Six-week mentored cohort",
    body: "Built around a live requirement from a hiring partner, so the work you do is the work they need done.",
    cadence: "Rolling intake · limited seats",
    href: "/program",
  },
  {
    tag: "Challenge",
    tagClass: "tag tag-outline",
    title: "Scoped company challenge",
    body: "A real problem, a clear brief, a week to answer it. Do it on your own schedule, from anywhere.",
    cadence: "Always open · start any day",
    href: "/challenges",
  },
];

export const FAQS = [
  {
    q: "Does it cost anything to join a cohort?",
    a: "Taking part is free for candidates. Companies pay us when they hire, so nobody is ever charged for the chance to be seen.",
  },
  {
    q: "What exactly do companies see before I consent?",
    a: "The work and the scores, with your name, contact details and employer hidden. They can ask for access; you decide whether to grant it, company by company.",
  },
  {
    q: "Do I need to be a student or a developer?",
    a: "No. Cohorts run across engineering, design, data and product. Some people are in their first year of college, some are ten years into a career and want a different door.",
  },
  {
    q: "We have a niche requirement. Can you build a cohort for it?",
    a: "Yes — that is the normal way we work with companies. Send us the role, the stack and the timeline, and we design the challenge and recruit the cohort around it.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "We saw four weeks of her work before we ever spoke to her. The interview was a conversation, not a test.",
    attribution: "Hiring lead, product engineering team",
  },
  {
    quote:
      "I'd been rejected on my resume a dozen times. Here they looked at what I built, and I chose who got to see it.",
    attribution: "Cohort graduate, hired in 2025",
  },
];
