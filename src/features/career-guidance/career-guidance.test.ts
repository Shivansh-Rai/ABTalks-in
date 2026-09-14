/**
 * Career guidance rules — T-224.
 *
 * Pure-function checks. Every card must cite a fact on CandidateFacts;
 * invented statistics and generic market copy must never appear.
 *
 * Run: npm run test:career-guidance
 */
import { evaluateRules } from "@/features/career-guidance/rules";
import {
  catalogWhenMatches,
  GUIDANCE_CATALOG,
  type CatalogItem,
  type GuidanceTargeting,
} from "@/features/career-guidance/catalog";
import {
  cardsForFrozenIds,
  pickDailyPack,
  rememberPack,
  visibleDailyCards,
} from "@/features/career-guidance/pick-daily";
import {
  DAILY_CAP,
  GUIDANCE_CAP,
  type CandidateFacts,
  type GuidanceFlags,
  type GuidanceItem,
} from "@/features/career-guidance/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

const FLAGS_ON: GuidanceFlags = {
  program: true,
  databricks: true,
  dsArchitect: true,
  powerBi: true,
  claude: true,
};

const LIVE_MOCKS: CandidateFacts["mocks"] = [
  { slug: "ai-fluency", label: "AI Fluency", attemptsLeft: 3 },
  { slug: "agentic-coding", label: "Vibe Coding", attemptsLeft: 3 },
];

function facts(over: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    challenges: [],
    aiCohortStatus: null,
    databricksStatus: null,
    dsArchitectStatus: null,
    powerBiStatus: null,
    hackathonRegistered: false,
    hackathonRegistrationOpen: false,
    skills: [],
    preferredRoles: [],
    opportunityTypes: [],
    flags: FLAGS_ON,
    mocks: LIVE_MOCKS,
    jobs: [],
    appliedJobIds: [],
    ...over,
  };
}

function byId(items: GuidanceItem[], id: string): GuidanceItem | undefined {
  return items.find((i) => i.id === id);
}

console.log("\ncareer-guidance");

suite("empty facts produce no cards", () => {
  const items = evaluateRules(facts());
  assert(items.length === 0, `expected 0, got ${items.length}`);
});

suite("completed AI cohort → mock, not another AI cohort apply", () => {
  const items = evaluateRules(
    facts({
      aiCohortStatus: "COMPLETED",
      challenges: [{ domain: "AI", status: "COMPLETED" }],
    }),
  );
  const mock = byId(items, "completed-ai-cohort-mock");
  assert(!!mock, "missing mock");
  assert(mock?.kind === "mock", "kind");
  assert(mock?.href === "/mock-interviews/ai-fluency", mock?.href ?? "");
  assert(
    mock?.because === "You completed the 31-day AI Cohort.",
    mock?.because ?? "",
  );
  assert(
    !items.some((i) => i.href === "/program/ai-cohort/apply"),
    "must not recommend applying to a finished cohort",
  );
});

suite("AI challenge ACTIVE → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "AI", status: "ACTIVE" }] }),
  );
  const card = byId(items, "ai-challenge-to-cohort");
  assert(!!card, "missing cohort card");
  assert(card?.href === "/program/ai-cohort/apply", card?.href ?? "");
  assert(
    card?.because ===
      "You are on the Artificial Intelligence 60-day challenge.",
    card?.because ?? "",
  );
});

suite("AI challenge COMPLETED → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "AI", status: "COMPLETED" }] }),
  );
  const card = byId(items, "ai-challenge-to-cohort");
  assert(!!card, "missing");
  assert(
    card?.because ===
      "You completed the Artificial Intelligence 60-day challenge.",
    card?.because ?? "",
  );
});

suite("AI challenge skipped when already in AI cohort", () => {
  const items = evaluateRules(
    facts({
      aiCohortStatus: "ACTIVE",
      challenges: [{ domain: "AI", status: "ACTIVE" }],
    }),
  );
  assert(
    !items.some((i) => i.href === "/program/ai-cohort/apply"),
    "already enrolled",
  );
});

suite("Claude COMPLETED → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "CLAUDE", status: "COMPLETED" }] }),
  );
  const card = byId(items, "claude-completed-to-cohort");
  assert(!!card, "missing");
  assert(card?.because === "You completed the Claude Challenge.", card?.because ?? "");
  assert(card?.href === "/program/ai-cohort/apply", card?.href ?? "");
});

suite("Claude ACTIVE does not recommend AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "CLAUDE", status: "ACTIVE" }] }),
  );
  assert(
    !items.some((i) => i.href === "/program/ai-cohort/apply"),
    "Claude in progress is not the completed-Claude rule",
  );
});

suite("DS ACTIVE → Databricks", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "DS", status: "ACTIVE" }] }),
  );
  const card = byId(items, "ds-challenge-to-databricks");
  assert(!!card, "missing");
  assert(card?.href === "/program/databricks", card?.href ?? "");
  assert(
    card?.because === "You are on the Data Science 60-day challenge.",
    card?.because ?? "",
  );
});

suite("DS ACTIVE skipped when Databricks flag off", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "DS", status: "ACTIVE" }],
      flags: { ...FLAGS_ON, databricks: false },
    }),
  );
  assert(
    !items.some((i) => i.href === "/program/databricks"),
    "flag off",
  );
});

suite("DS ACTIVE skipped when already on Databricks", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "DS", status: "ACTIVE" }],
      databricksStatus: "ACTIVE",
    }),
  );
  assert(
    !items.some((i) => i.href === "/program/databricks"),
    "already enrolled",
  );
});

suite("Databricks COMPLETED → DS Architect", () => {
  const items = evaluateRules(
    facts({ databricksStatus: "COMPLETED" }),
  );
  const card = byId(items, "databricks-to-ds-architect");
  assert(!!card, "missing");
  assert(
    card?.because === "You completed the 31 Days Databricks cohort.",
    card?.because ?? "",
  );
});

suite("Power BI skill + DS challenge → Power BI cohort", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "DS", status: "ACTIVE" }],
      skills: [{ name: "Power BI", categoryName: "Data & AI" }],
    }),
  );
  const card = byId(items, "ds-to-powerbi");
  assert(!!card, "missing");
  assert(
    card?.because === "You listed Power BI on your profile.",
    card?.because ?? "",
  );
});

suite("job with overlapping skill cites that skill", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
      jobs: [
        {
          id: "job-1",
          title: "Data Analyst",
          company: "Acme",
          skills: ["Pandas", "Excel"],
          type: "FULL_TIME",
        },
      ],
    }),
  );
  const card = byId(items, "job-job-1");
  assert(!!card, "missing job card");
  assert(
    card?.because ===
      "This listing asks for Pandas, which is on your profile.",
    card?.because ?? "",
  );
  assert(card?.href === "/jobs/job-1", card?.href ?? "");
  assert(!/salary|%|market/i.test(card?.because ?? ""), "invented stats");
});

suite("unrelated job does not appear", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
      jobs: [
        {
          id: "job-2",
          title: "Payroll Clerk",
          company: "Acme",
          skills: ["Excel"],
          type: "FULL_TIME",
        },
      ],
    }),
  );
  assert(
    !items.some((i) => i.href === "/jobs/job-2"),
    "unrelated job leaked",
  );
});

suite("already-applied job is skipped", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Pandas", categoryName: null }],
      jobs: [
        {
          id: "job-3",
          title: "Analyst",
          company: "Acme",
          skills: ["Pandas"],
          type: "FULL_TIME",
        },
      ],
      appliedJobIds: ["job-3"],
    }),
  );
  assert(!items.some((i) => i.href === "/jobs/job-3"), "applied job leaked");
});

suite("preferred-role job match cites the role", () => {
  const items = evaluateRules(
    facts({
      preferredRoles: ["Data Scientist"],
      jobs: [
        {
          id: "job-4",
          title: "Junior Data Scientist",
          company: "North",
          skills: [],
          type: "FULL_TIME",
        },
      ],
    }),
  );
  const card = byId(items, "job-job-4");
  assert(!!card, "missing");
  assert(
    card?.because === "It matches your preferred role Data Scientist.",
    card?.because ?? "",
  );
});

suite("Python alone does not fire Databricks or a DS challenge join", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Python", categoryName: "Languages" }],
    }),
  );
  assert(
    !items.some((i) => i.href === "/program/databricks"),
    "python must not imply Databricks",
  );
  assert(
    !items.some((i) => i.href === "/register?domain=DS"),
    "python must not imply DS challenge",
  );
});

suite("Pandas skill without a DS enrollment recommends the DS challenge", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
    }),
  );
  const card = byId(items, "skill-to-ds-challenge");
  assert(!!card, "missing");
  assert(card?.href === "/register?domain=DS", card?.href ?? "");
  assert(
    card?.because === "You listed Pandas on your profile.",
    card?.because ?? "",
  );
});

suite("abandoned DS domain is not re-recommended from skills", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "DS", status: "ABANDONED" }],
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
    }),
  );
  assert(
    !items.some((i) => i.href === "/register?domain=DS"),
    "abandoned",
  );
});

suite("SE challenge + open hackathon → register", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "SE", status: "ACTIVE" }],
      hackathonRegistrationOpen: true,
    }),
  );
  const card = byId(items, "challenge-to-hackathon");
  assert(!!card, "missing");
  assert(card?.href === "/hackathon", card?.href ?? "");
  assert(
    card?.because === "You are on the Software Engineering 60-day challenge.",
    card?.because ?? "",
  );
});

suite("completed challenge (non-SE) still opens hackathon when SE did not", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "AI", status: "COMPLETED" }],
      hackathonRegistrationOpen: true,
    }),
  );
  const card = byId(items, "challenge-to-hackathon");
  assert(!!card, "missing fallback hackathon");
});

suite("hackathon skipped when already registered", () => {
  const items = evaluateRules(
    facts({
      challenges: [{ domain: "SE", status: "COMPLETED" }],
      hackathonRegistrationOpen: true,
      hackathonRegistered: true,
    }),
  );
  assert(!items.some((i) => i.href === "/hackathon"), "already registered");
});

suite("completed SE → vibe-coding mock when no cohort mock fired", () => {
  const items = evaluateRules(
    facts({ challenges: [{ domain: "SE", status: "COMPLETED" }] }),
  );
  const card = byId(items, "completed-challenge-mock-se");
  assert(!!card, "missing");
  assert(card?.href === "/mock-interviews/agentic-coding", card?.href ?? "");
});

suite("exhausted mock attempts skip the mock card", () => {
  const items = evaluateRules(
    facts({
      aiCohortStatus: "COMPLETED",
      mocks: [
        { slug: "ai-fluency", label: "AI Fluency", attemptsLeft: 0 },
        { slug: "agentic-coding", label: "Vibe Coding", attemptsLeft: 3 },
      ],
    }),
  );
  assert(!items.some((i) => i.kind === "mock"), "exhausted mock leaked");
});

suite("hrefs are unique and the list caps at 6", () => {
  const jobs = Array.from({ length: 8 }, (_, i) => ({
    id: `job-${i}`,
    title: "Data Scientist",
    company: `Co${i}`,
    skills: ["Pandas"],
    type: "FULL_TIME",
  }));
  const items = evaluateRules(
    facts({
      challenges: [
        { domain: "AI", status: "COMPLETED" },
        { domain: "DS", status: "COMPLETED" },
        { domain: "SE", status: "COMPLETED" },
        { domain: "CLAUDE", status: "COMPLETED" },
      ],
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
      preferredRoles: ["Data Scientist"],
      hackathonRegistrationOpen: true,
      jobs,
    }),
  );
  assert(items.length <= GUIDANCE_CAP, `cap ${items.length}`);
  const hrefs = items.map((i) => i.href);
  assert(new Set(hrefs).size === hrefs.length, "duplicate href");
});

suite("because lines never invent percentages or salary", () => {
  const items = evaluateRules(
    facts({
      aiCohortStatus: "COMPLETED",
      challenges: [{ domain: "AI", status: "COMPLETED" }],
      skills: [{ name: "PyTorch", categoryName: "Data & AI" }],
      jobs: [
        {
          id: "job-pay",
          title: "ML Engineer",
          company: "Acme",
          skills: ["PyTorch"],
          type: "FULL_TIME",
        },
      ],
    }),
  );
  assert(items.length > 0, "expected cards");
  for (const item of items) {
    assert(
      !/\d+\s*%|salary|LPA|market demand|job-ready/i.test(item.because),
      item.because,
    );
  }
});

suite("source does not call an LLM", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/career-guidance/rules.ts"),
    "utf8",
  );
  assert(!/openai|anthropic|generateText|AskJson/i.test(src), "llm import");
});

const EMPTY_TARGETING: GuidanceTargeting = {
  challengeDomains: [],
  aiCohortActive: false,
  aiCohortCompleted: false,
  skillNames: [],
  preferredRoles: [],
  skillsEmpty: true,
};

function profileCard(id: string): GuidanceItem {
  return {
    id,
    kind: "cohort",
    title: id,
    because: `Fact for ${id}.`,
    href: `/go/${id}`,
    cta: "Apply",
  };
}

const SAMPLE_CATALOG: CatalogItem[] = [
  {
    id: "checkin-se",
    kind: "checkin",
    cadence: "daily",
    title: "DSA today?",
    body: "Reminder only.",
    ctaLabel: "I did",
    when: { challengeDomains: ["SE"] },
  },
  {
    id: "checkin-always",
    kind: "checkin",
    cadence: "daily",
    title: "Practise?",
    body: "Reminder only.",
    ctaLabel: "I did",
    when: { always: true },
  },
  {
    id: "quote-once",
    kind: "quote",
    cadence: "once",
    title: "A short attributed line.",
    body: "Seneca",
    when: { always: true },
  },
  {
    id: "quote-weekly",
    kind: "quote",
    cadence: "weekly",
    title: "Another attributed line.",
    body: "Plato",
    when: { always: true },
  },
];

suite("daily pack caps at 4 and prefers profile recs", () => {
  const pack = pickDailyPack({
    profileItems: [
      profileCard("p1"),
      profileCard("p2"),
      profileCard("p3"),
      profileCard("p4"),
      profileCard("p5"),
    ],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack.length === DAILY_CAP, `cap ${pack.length}`);
  assert(
    pack.every((c) => c.source === "profile"),
    "catalog leaked while profile filled the cap",
  );
  assert(pack[3]?.id === "p4", pack[3]?.id ?? "");
});

suite("profile recs come before a check-in and quote", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1")],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack.length === 3, `got ${pack.length}`);
  assert(pack[0]?.id === "p1", "profile first");
  assert(pack[1]?.kind === "checkin", "then check-in");
  assert(pack[1]?.id === "checkin-always", "generic check-in, not SE");
  assert(pack[2]?.kind === "quote", "then quote");
});

suite("once catalog cards never return after seen", () => {
  const first = pickDailyPack({
    profileItems: [],
    catalog: SAMPLE_CATALOG.filter((i) => i.kind === "quote"),
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(first[0]?.id === "quote-once", first[0]?.id ?? "");
  const remembered = rememberPack(
    {
      istDay: "2026-09-14",
      packIds: null,
      dismissedIds: [],
      onceSeen: [],
      weeklySeen: {},
    },
    first,
    new Map(SAMPLE_CATALOG.map((i) => [i.id, i])),
    "2026-W38",
  );
  const second = pickDailyPack({
    profileItems: [],
    catalog: SAMPLE_CATALOG.filter((i) => i.kind === "quote"),
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: remembered.onceSeen,
    weeklySeen: remembered.weeklySeen,
  });
  assert(second[0]?.id === "quote-weekly", second[0]?.id ?? "missing weekly");
  assert(
    !second.some((c) => c.id === "quote-once"),
    "once quote returned",
  );
});

suite("weekly catalog cards are blocked in the same week", () => {
  const pack = pickDailyPack({
    profileItems: [],
    catalog: SAMPLE_CATALOG.filter((i) => i.id === "quote-weekly"),
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: { "quote-weekly": "2026-W38" },
  });
  assert(pack.length === 0, "same-week weekly quote leaked");
});

suite("dismissed id is removed and not replaced", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1"), profileCard("p2")],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  const frozen = rememberPack(
    {
      istDay: "2026-09-14",
      packIds: null,
      dismissedIds: [],
      onceSeen: [],
      weeklySeen: {},
    },
    pack,
    new Map(SAMPLE_CATALOG.map((i) => [i.id, i])),
    "2026-W38",
  );
  const rebuilt = cardsForFrozenIds(
    frozen.packIds ?? [],
    [profileCard("p1"), profileCard("p2"), profileCard("p3")],
    SAMPLE_CATALOG,
  );
  const visible = visibleDailyCards(rebuilt, ["p1"]);
  assert(!visible.some((c) => c.id === "p1"), "dismissed still visible");
  assert(!visible.some((c) => c.id === "p3"), "backfilled a new profile card");
  assert(visible.length === pack.length - 1, `len ${visible.length}`);
});

suite("all dismissed yields an empty visible list", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1")],
    catalog: [],
    targeting: EMPTY_TARGETING,
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  const visible = visibleDailyCards(pack, pack.map((c) => c.id));
  assert(visible.length === 0, "expected empty");
});

suite("catalog when does not fire without the named domain", () => {
  assert(
    !catalogWhenMatches(
      { challengeDomains: ["SE"] },
      EMPTY_TARGETING,
    ),
    "SE check-in without SE enrollment",
  );
  assert(
    catalogWhenMatches(
      { challengeDomains: ["SE"] },
      { ...EMPTY_TARGETING, challengeDomains: ["SE"] },
    ),
    "SE check-in should match SE",
  );
  assert(
    !catalogWhenMatches(
      { skillIncludes: ["pandas"] },
      { ...EMPTY_TARGETING, skillNames: ["Python"], skillsEmpty: false },
    ),
    "pandas when without pandas skill",
  );
});

suite("catalog.json parses", () => {
  assert(GUIDANCE_CATALOG.length >= 8, String(GUIDANCE_CATALOG.length));
  assert(
    GUIDANCE_CATALOG.some((i) => i.kind === "checkin") &&
      GUIDANCE_CATALOG.some((i) => i.kind === "quote"),
    "catalog must mix check-ins and quotes",
  );
});

suite("catalog copy has no invented salary or market claims", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/career-guidance/catalog.json"),
    "utf8",
  );
  assert(!/salary|LPA|market demand|job-ready|\d+\s*%/i.test(src), src);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
