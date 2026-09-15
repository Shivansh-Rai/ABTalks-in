/**
 * Career guidance — T-224 / plan 146.
 *
 * Pure-function checks. Every card must cite a fact on CandidateFacts;
 * invented statistics and generic market copy must never appear.
 *
 * Run: npm run test:career-guidance
 */
import { evaluateRules } from "@/features/career-guidance/rules";
import {
  catalogSpecificity,
  catalogWhenMatches,
  GUIDANCE_CATALOG,
  type CatalogItem,
  type GuidanceTargeting,
} from "@/features/career-guidance/catalog";
import {
  cardsForFrozenIds,
  pickDailyPack,
  pickRefillCard,
  rememberPack,
  visibleDailyCards,
} from "@/features/career-guidance/pick-daily";
import {
  isGuidanceCompleted,
  matchingSkillNames,
  softDedupeProfileItems,
} from "@/features/career-guidance/progression";
import {
  DAILY_CAP,
  GUIDANCE_COMPLETED_DAYS,
  GUIDANCE_POOL_CAP,
  type CandidateFacts,
  type ChallengeFact,
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

function ch(
  domain: ChallengeFact["domain"],
  status: ChallengeFact["status"],
  daysCompleted = 0,
): ChallengeFact {
  return { domain, status, daysCompleted };
}

function facts(over: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    challenges: [],
    aiCohortStatus: null,
    databricksStatus: null,
    dsArchitectStatus: null,
    powerBiStatus: null,
    hackathonRegistered: false,
    hackathonRegistrationOpen: false,
    hasClaudeCredential: false,
    skills: [],
    preferredRoles: [],
    flags: FLAGS_ON,
    mocks: LIVE_MOCKS,
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
      challenges: [ch("AI", "COMPLETED", 60)],
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

suite("APPLIED AI cohort → continue (not apply)", () => {
  const items = evaluateRules(facts({ aiCohortStatus: "APPLIED" }));
  const card = byId(items, "ai-cohort-continue-application");
  assert(!!card, "missing continue");
  assert(card?.href === "/program/ai-cohort/dashboard", card?.href ?? "");
  assert(
    card?.because === "You applied to the 31-day AI Cohort.",
    card?.because ?? "",
  );
  assert(
    !items.some((i) => i.href === "/program/ai-cohort/apply"),
    "apply leaked",
  );
});

suite("AI challenge ACTIVE → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("AI", "ACTIVE", 12)] }),
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

suite("AI challenge days≥50 counts as guidance-completed", () => {
  assert(
    isGuidanceCompleted(ch("AI", "ACTIVE", GUIDANCE_COMPLETED_DAYS)),
    "gate",
  );
  const items = evaluateRules(
    facts({
      challenges: [ch("AI", "ACTIVE", GUIDANCE_COMPLETED_DAYS)],
    }),
  );
  const card = byId(items, "ai-challenge-to-cohort");
  assert(!!card, "missing");
  assert(
    card?.because ===
      "You completed the Artificial Intelligence 60-day challenge.",
    card?.because ?? "",
  );
});

suite("AI challenge COMPLETED → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("AI", "COMPLETED", 60)] }),
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
      challenges: [ch("AI", "ACTIVE", 10)],
    }),
  );
  assert(
    !items.some((i) => i.href.includes("/program/ai-cohort")),
    "already enrolled",
  );
});

suite("Claude COMPLETED → AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("CLAUDE", "COMPLETED", 31)] }),
  );
  const card = byId(items, "claude-completed-to-cohort");
  assert(!!card, "missing");
  assert(
    card?.because === "You completed the Claude Challenge.",
    card?.because ?? "",
  );
  assert(card?.href === "/program/ai-cohort/apply", card?.href ?? "");
});

suite("Claude credential alone → AI cohort", () => {
  const items = evaluateRules(facts({ hasClaudeCredential: true }));
  const card = byId(items, "claude-completed-to-cohort");
  assert(!!card, "missing");
  assert(
    card?.because === "You completed the Claude Challenge.",
    card?.because ?? "",
  );
});

suite("Claude ACTIVE does not recommend AI cohort", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("CLAUDE", "ACTIVE", 5)] }),
  );
  assert(
    !items.some((i) => i.href === "/program/ai-cohort/apply"),
    "Claude in progress is not the completed-Claude rule",
  );
});

suite("DS ACTIVE → Databricks", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("DS", "ACTIVE", 8)] }),
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
      challenges: [ch("DS", "ACTIVE", 8)],
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
      challenges: [ch("DS", "ACTIVE", 8)],
      databricksStatus: "ACTIVE",
    }),
  );
  assert(
    !items.some((i) => i.href === "/program/databricks"),
    "already enrolled",
  );
});

suite("Databricks COMPLETED → DS Architect", () => {
  const items = evaluateRules(facts({ databricksStatus: "COMPLETED" }));
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
      challenges: [ch("DS", "ACTIVE", 8)],
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

suite("no job / opportunity recommendations", () => {
  const items = evaluateRules(
    facts({
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
      preferredRoles: ["Data Scientist"],
    }),
  );
  assert(
    !items.some((i) => i.href.startsWith("/jobs/")),
    "job card leaked",
  );
  assert(
    !items.some((i) => i.kind === ("opportunity" as GuidanceItem["kind"])),
    "opportunity kind leaked",
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

suite("skill alias react.js matches React needle", () => {
  const hits = matchingSkillNames(
    [{ name: "react.js", categoryName: null }],
    ["react"],
  );
  assert(hits.includes("react.js"), hits.join(","));
  const items = evaluateRules(
    facts({
      skills: [{ name: "react.js", categoryName: null }],
    }),
  );
  const card = byId(items, "skill-to-se-challenge");
  assert(!!card, "missing SE from alias");
});

suite("abandoned DS domain is not re-recommended from skills", () => {
  const items = evaluateRules(
    facts({
      challenges: [ch("DS", "ABANDONED", 3)],
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
      challenges: [ch("SE", "ACTIVE", 10)],
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
      challenges: [ch("AI", "COMPLETED", 60)],
      hackathonRegistrationOpen: true,
    }),
  );
  const card = byId(items, "challenge-to-hackathon");
  assert(!!card, "missing fallback hackathon");
});

suite("hackathon skipped when already registered", () => {
  const items = evaluateRules(
    facts({
      challenges: [ch("SE", "COMPLETED", 60)],
      hackathonRegistrationOpen: true,
      hackathonRegistered: true,
    }),
  );
  assert(!items.some((i) => i.href === "/hackathon"), "already registered");
});

suite("completed SE → vibe-coding mock when no cohort mock fired", () => {
  const items = evaluateRules(
    facts({ challenges: [ch("SE", "COMPLETED", 60)] }),
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

suite("hrefs are unique and the pool caps at GUIDANCE_POOL_CAP", () => {
  const items = evaluateRules(
    facts({
      challenges: [
        ch("AI", "COMPLETED", 60),
        ch("DS", "COMPLETED", 60),
        ch("SE", "COMPLETED", 60),
        ch("CLAUDE", "COMPLETED", 31),
      ],
      skills: [{ name: "Pandas", categoryName: "Data & AI" }],
      preferredRoles: ["Data Scientist"],
      hackathonRegistrationOpen: true,
    }),
  );
  assert(items.length <= GUIDANCE_POOL_CAP, `cap ${items.length}`);
  const hrefs = items.map((i) => i.href);
  assert(new Set(hrefs).size === hrefs.length, "duplicate href");
});

suite("because lines never invent percentages or salary", () => {
  const items = evaluateRules(
    facts({
      aiCohortStatus: "COMPLETED",
      challenges: [ch("AI", "COMPLETED", 60)],
      skills: [{ name: "PyTorch", categoryName: "Data & AI" }],
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
  const rules = readFileSync(
    join(process.cwd(), "src/features/career-guidance/rules.ts"),
    "utf8",
  );
  const progression = readFileSync(
    join(process.cwd(), "src/features/career-guidance/progression.ts"),
    "utf8",
  );
  assert(!/openai|anthropic|generateText|AskJson/i.test(rules), "llm rules");
  assert(
    !/openai|anthropic|generateText|AskJson/i.test(progression),
    "llm progression",
  );
});

suite("soft-dedupe drops ACTIVE challenge join already on hub", () => {
  const f = facts({ challenges: [ch("DS", "ACTIVE", 5)] });
  const filtered = softDedupeProfileItems(
    [
      {
        id: "skill-to-ds-challenge",
        kind: "challenge",
        title: "Data Science",
        because: "You listed Pandas on your profile.",
        href: "/register?domain=DS",
        cta: "Join",
      },
      {
        id: "keep",
        kind: "cohort",
        title: "Keep",
        because: "Fact.",
        href: "/program/databricks",
        cta: "Open",
      },
    ],
    f,
  );
  assert(
    !filtered.some((i) => i.href === "/register?domain=DS"),
    "ACTIVE DS join must soft-dedupe",
  );
  assert(filtered.some((i) => i.id === "keep"), "unrelated kept");
});

const EMPTY_TARGETING: GuidanceTargeting = {
  challengeDomains: [],
  aiCohortActive: false,
  aiCohortCompleted: false,
  skillNames: [],
  preferredRoles: [],
  skillsEmpty: true,
};

function profileCard(
  id: string,
  kind: GuidanceItem["kind"] = "cohort",
): GuidanceItem {
  return {
    id,
    kind,
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
    href: "/mock-interviews",
    when: { challengeDomains: ["SE"] },
  },
  {
    id: "checkin-always",
    kind: "checkin",
    cadence: "daily",
    title: "Practise?",
    body: "Reminder only.",
    ctaLabel: "I did",
    href: "/mock-interviews",
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

suite("daily pack caps at 4 with slot mix (≤2 next-step + catalog)", () => {
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
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack.length === DAILY_CAP, `cap ${pack.length}`);
  const nextStep = pack.filter((c) => c.source === "profile").length;
  const catalog = pack.filter((c) => c.source === "catalog").length;
  assert(nextStep >= 2, `expected profile fill, got ${nextStep}`);
  assert(catalog === 1, `expected one catalog slot, got ${catalog}`);
});

suite("slot mix: next-step then one check-in (not check-in+quote)", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1")],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack.length === 2, `got ${pack.length}`);
  assert(pack[0]?.id === "p1", "profile first");
  assert(pack[1]?.kind === "checkin", "then one check-in");
  assert(pack[1]?.id === "checkin-always", "generic check-in, not SE");
  assert(!pack.some((c) => c.kind === "quote"), "quote with check-in present");
});

suite("growth slot takes one challenge before fill", () => {
  const pack = pickDailyPack({
    profileItems: [
      profileCard("c1", "cohort"),
      profileCard("ch1", "challenge"),
      profileCard("ch2", "challenge"),
    ],
    catalog: [],
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack.some((c) => c.id === "c1"), "cohort");
  assert(pack.some((c) => c.kind === "challenge"), "growth challenge");
  // Primary growth slot is ≤1; leftover fill may add a second challenge.
  assert(pack.length <= DAILY_CAP, `cap ${pack.length}`);
  assert(pack[0]?.kind === "cohort" || pack[1]?.kind === "challenge", "order");
});

suite("catalog specificity prefers targeted check-in", () => {
  assert(
    catalogSpecificity({ challengeDomains: ["SE"] }) >
      catalogSpecificity({ always: true }),
    "specificity order",
  );
  const pack = pickDailyPack({
    profileItems: [],
    catalog: SAMPLE_CATALOG,
    targeting: {
      ...EMPTY_TARGETING,
      challengeDomains: ["SE"],
      skillsEmpty: false,
    },
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(pack[0]?.id === "checkin-se", pack[0]?.id ?? "");
});

suite("once catalog cards never return after seen", () => {
  const quotes = SAMPLE_CATALOG.filter((i) => i.kind === "quote");
  // Force the once-quote by excluding weekly from the first pack.
  const first = pickDailyPack({
    profileItems: [],
    catalog: quotes.filter((i) => i.id === "quote-once"),
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  assert(first[0]?.id === "quote-once", first[0]?.id ?? "");
  const remembered = rememberPack(
    {
      istDay: "2026-09-15",
      packIds: null,
      dismissedIds: [],
      onceSeen: [],
      weeklySeen: {},
      refillUsed: false,
    },
    first,
    new Map(SAMPLE_CATALOG.map((i) => [i.id, i])),
    "2026-W38",
  );
  const second = pickDailyPack({
    profileItems: [],
    catalog: quotes,
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
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
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: { "quote-weekly": "2026-W38" },
  });
  assert(pack.length === 0, "same-week weekly quote leaked");
});

suite("dismissed id is removed; frozen pack does not backfill", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1"), profileCard("p2")],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  const frozen = rememberPack(
    {
      istDay: "2026-09-15",
      packIds: null,
      dismissedIds: [],
      onceSeen: [],
      weeklySeen: {},
      refillUsed: false,
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

suite("refill picks one unused profile card", () => {
  const refill = pickRefillCard({
    profileItems: [profileCard("p1"), profileCard("p2")],
    catalog: SAMPLE_CATALOG,
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    packIds: ["p1"],
    dismissedIds: ["p1"],
    onceSeen: [],
    weeklySeen: {},
  });
  assert(refill?.id === "p2", refill?.id ?? "missing refill");
});

suite("all dismissed yields an empty visible list", () => {
  const pack = pickDailyPack({
    profileItems: [profileCard("p1")],
    catalog: [],
    targeting: EMPTY_TARGETING,
    istDay: "2026-09-15",
    istWeek: "2026-W38",
    onceSeen: [],
    weeklySeen: {},
  });
  const visible = visibleDailyCards(
    pack,
    pack.map((c) => c.id),
  );
  assert(visible.length === 0, "expected empty");
});

suite("catalog when does not fire without the named domain", () => {
  assert(
    !catalogWhenMatches({ challengeDomains: ["SE"] }, EMPTY_TARGETING),
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

suite("catalog.json parses with check-in hrefs", () => {
  assert(GUIDANCE_CATALOG.length >= 8, String(GUIDANCE_CATALOG.length));
  assert(
    GUIDANCE_CATALOG.some((i) => i.kind === "checkin") &&
      GUIDANCE_CATALOG.some((i) => i.kind === "quote"),
    "catalog must mix check-ins and quotes",
  );
  for (const item of GUIDANCE_CATALOG.filter((i) => i.kind === "checkin")) {
    assert(!!item.href, `${item.id} missing href`);
  }
});

suite("catalog copy has no invented salary or market claims", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/career-guidance/catalog.json"),
    "utf8",
  );
  assert(!/salary|LPA|market demand|job-ready|\d+\s*%/i.test(src), src);
});

suite("types and rules drop jobs", () => {
  const types = readFileSync(
    join(process.cwd(), "src/features/career-guidance/types.ts"),
    "utf8",
  );
  const loader = readFileSync(
    join(process.cwd(), "src/features/career-guidance/get-career-guidance.ts"),
    "utf8",
  );
  assert(!/\bjobs\b|JobFact|opportunityTypes/.test(types), "types still jobs");
  assert(!/listPublishedJobs|appliedJobIds|\/jobs\//.test(loader), "loader jobs");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
