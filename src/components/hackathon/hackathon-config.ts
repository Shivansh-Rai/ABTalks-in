export const HACKATHON = {
  name: "ABTalks Vibe Code Hackathon",
  tagline: "48 hours. No boilerplate. Just you, your ideas, and AI.",
  registrationOpen: true,
  maxTeamSize: 3,

  // TODO(organizer): replace the three date values below before launch.
  kickoffUtc: "2026-08-14T14:30:00Z", // Fri 8:00 PM IST
  deadlineUtc: "2026-08-16T14:30:00Z", // Sun 8:00 PM IST
  kickoffLabel: "Friday, 14 Aug · 8:00 PM IST",
  deadlineLabel: "Sunday, 16 Aug · 8:00 PM IST",
  resultsLabel: "Winners announced: Friday, 21 Aug",
  registrationClosesLabel: "Registration closes Thursday, 13 Aug · 11:59 PM IST",

  whatsappLink: "#", // TODO(organizer)
  prizes: [] as { place: string; reward: string }[], // empty ⇒ "announced soon" state

  steps: [
    {
      title: "Register",
      body: "Sign up solo or create a team of up to 3. It takes under two minutes and it's free.",
    },
    {
      title: "Join the WhatsApp group",
      body: "After you register, hop into the event group. Kickoff updates and the problem statement land there first.",
    },
    {
      title: "Build for 48 hours",
      body: "From Friday kickoff to Sunday deadline — describe what you want, let AI write the code, ship something real.",
    },
    {
      title: "Submit before the deadline",
      body: "Public GitHub repo, live deployed URL, and your AI-usage log. Late submissions don't count.",
    },
  ],

  timeline: [
    {
      title: "Kickoff",
      body: "Problem statement drops. Clock starts. Build anything — product judgment over typing speed.",
    },
    {
      title: "Midpoint check-in",
      body: "Optional pulse check in WhatsApp. Share progress, unblock teammates, keep shipping.",
    },
    {
      title: "Deadline",
      body: "Repos locked. Repo public, deploy live, PROMPTS.md (or chat exports) in place.",
    },
    {
      title: "Results",
      body: "Winners announced. Criteria: originality, polish, and how well you steered the AI.",
    },
  ],

  deliverables: [
    {
      title: "Public GitHub repo",
      body: "Your full project source, public and cloneable. Private repos won't be judged.",
    },
    {
      title: "Live deployed URL",
      body: "Something we can open — Vercel, Netlify, or any reachable host. A README-only demo doesn't count.",
    },
    {
      title: "AI-usage log",
      body: "A PROMPTS.md in the repo, or exported chat transcripts. This is how we verify the build was genuinely vibe-coded.",
    },
  ],

  rules: [
    {
      title: "Solo or teams of up to 3",
      body: "Enter alone or create a team. One shareable 6-character code joins teammates — max three people total.",
    },
    {
      title: "Open to Indian college students",
      body: "1st year through recent grads. One entry per person — enforced by email.",
    },
    {
      title: "Build starts at kickoff",
      body: "No head starts. Anything pre-built must be disclosed in your submission notes.",
    },
    {
      title: "Fair play",
      body: "Use any AI coding tool. Don't submit someone else's work as yours. Be kind in the community chat.",
    },
  ],

  judging: [
    {
      title: "Product judgment",
      body: "Did you pick a sharp problem and ship a coherent answer?",
    },
    {
      title: "Prompting skill",
      body: "Does the AI-usage log show deliberate steering, not blind copy-paste?",
    },
    {
      title: "Polish & deploy",
      body: "Does it run live, look intentional, and explain itself clearly?",
    },
  ],

  faq: [
    {
      q: "Do I need a team?",
      a: "No. Solo entries are welcome. If you want teammates, create a team and share the 6-character code — up to 3 people total.",
    },
    {
      q: "What if I can't code?",
      a: "That's the point of vibe coding. You describe the product; tools like Cursor or Claude Code write the implementation. Judgment and prompting matter more than typing speed.",
    },
    {
      q: "Is it free?",
      a: "Yes. Registration and entry are completely free.",
    },
    {
      q: "What counts as vibe coding?",
      a: "You steer with natural language and AI writes most of the code. Hand-typing every line defeats the theme — we check your AI-usage log.",
    },
    {
      q: "Can I use a template?",
      a: "Starter templates and boilerplates are fine if you disclose them. The bulk of the product should be built during the 48 hours.",
    },
    {
      q: "How are winners picked?",
      a: "Judges weigh originality, how well you steered the AI (via your prompt log), and whether the live deploy actually works.",
    },
  ],
} as const;
