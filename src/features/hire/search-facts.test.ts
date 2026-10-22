/**
 * Search facts funnel, the summary template and its grounding check.
 * Pure: no database, no network. Run with:
 *   npx tsx src/features/hire/search-facts.test.ts
 */
import type { JobSpec } from "@/lib/validations/hire";
import type { ScoreableMember } from "@/features/hire/types";
import {
  computeSearchFacts,
  summaryIsGrounded,
  templateSearchSummary,
} from "@/features/hire/search-facts";

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

let seq = 0;
function member(over: Partial<ScoreableMember> = {}): ScoreableMember {
  seq += 1;
  return {
    id: `m${seq}`,
    userId: `u${seq}`,
    fullName: "Ada Example",
    jobRole: "AI Engineer",
    company: "",
    yearsExperience: 3,
    skills: ["Python", "SQL"],
    missionPoints: 0,
    missionsPassed: 0,
    missionsAttempted: 0,
    cleanPassCount: 0,
    totalScore: 0,
    commitDayCount: 0,
    projectScores: [],
    interview: null,
    hasVisibilityConsent: true,
    cohortPublished: true,
    status: "ENROLLED",
    availability: null,
    cohortDay: 0,
    roleTitles: ["AI Engineer"],
    ...over,
  };
}

function prefers(cities: string[]): ScoreableMember["availability"] {
  return {
    openToWork: true,
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    salaryCurrency: "INR",
    noticePeriodDays: null,
    preferredWorkMode: null,
    preferredCities: cities,
    openToRelocate: false,
    opportunityTypes: [],
  };
}

console.log("\nsearch facts");

const pool = [
  member({ skills: ["Python", "SQL"], yearsExperience: 4 }),
  member({ skills: ["Python"], yearsExperience: 1 }),
  member({ skills: ["Python", "SQL"], availability: prefers(["Mumbai"]) }),
  member({ skills: ["SQL"], availability: prefers(["Pune"]) }),
  member({ hasVisibilityConsent: false }),
];

const spec: JobSpec = {
  title: "AI engineer",
  locationCity: "Pune",
  minExperience: 2,
  mustHaveStack: ["python", "sql"],
};

suite("the funnel narrows role, filter, then skills", () => {
  const f = computeSearchFacts(pool, spec);
  assert(f.poolSize === 4, `pool ${f.poolSize}: the no-consent member is not in it`);
  assert(f.filters.length === 1 && f.filters[0]!.label === "Pune", "one city step");
  // Mumbai-only preference is out; unstated preference never excludes.
  assert(f.filters[0]!.left === 3, `after Pune ${f.filters[0]!.left}`);
  assert(f.skills[0]!.have === 2 && f.skills[1]!.have === 2, "python 2, sql 2");
  assert(f.matching === 1, `matching ${f.matching}`);
  assert(f.experience?.inBand === 1, "the one match has 4 years");
});

suite("experience reports, it never narrows", () => {
  const f = computeSearchFacts(pool, { ...spec, minExperience: 10 });
  assert(f.matching === 1, "a 10+ year ask still leaves the match in");
  assert(f.experience?.inBand === 0, "but none of them are in the band");
});

suite("the template states every fact and no em dash", () => {
  const f = computeSearchFacts(pool, spec);
  const text = templateSearchSummary(f, { shown: 3, strong: 1 });
  assert(text.includes("4 candidates"), text);
  assert(text.includes("Pune"), "names the filter");
  assert(text.includes("Python") && text.includes("SQL"), "names the skills");
  assert(text.includes("1 matching candidate"), "states the match count");
  assert(!text.includes("—"), "no em dash");
  assert(summaryIsGrounded(text, f, { shown: 3, strong: 1 }), "the template passes its own check");
});

suite("a nobody-yet search says so", () => {
  const f = computeSearchFacts(pool, { ...spec, mustHaveStack: ["rust"] });
  const text = templateSearchSummary(f, { shown: 2, strong: 0 });
  assert(f.matching === 0, "nobody has rust");
  assert(text.includes("Nobody in the pool meets all of that yet"), text);
});

suite("an invented number is rejected", () => {
  const f = computeSearchFacts(pool, spec);
  const top = { shown: 3, strong: 1 };
  assert(
    !summaryIsGrounded("I looked through 4 candidates and found 12 matching ones for you today.", f, top),
    "12 is not a fact",
  );
  assert(
    !summaryIsGrounded("I looked through 4 candidates — 1 matches.", f, top),
    "em dash is rejected",
  );
  assert(
    summaryIsGrounded("I looked through 4 candidates in Pune and 1 of them matches, with 2+ years of experience.", f, top),
    "label numbers (2+ years) are allowed",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
