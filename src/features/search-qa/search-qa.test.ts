/**
 * Recruiter search QA — offline regression suite. Run with:
 *   npm run test:recruiter-search
 *
 * No database, no network, no model. Deterministic: the golden dataset, the
 * pool construction and the combination generator are all seeded or fixed.
 *
 * Three result kinds:
 *   ✓ PASS
 *   ✗ FAIL   — exits non-zero. A regression, or a pinned known issue that has
 *              been FIXED (remove it from known-issues.ts).
 *   ◌ XFAIL  — a pinned, reported recruiter-search bug that still reproduces.
 *              Does not fail CI; does keep production readiness NOT READY.
 *
 * Expectations here are written by hand from the documented product rules.
 * None is derived from what the service currently returns.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jobSpecSchema, type JobSpec } from "@/lib/validations/hire";
import { CHALLENGE_POOL_CAP, MIN_RESULTS, RANK_WINDOW } from "@/features/hire/search-candidates";
import { extractPoolBrief } from "@/features/hire/pool-brief";
import { splitSkills } from "@/features/hire/challenge-dossier";
import type { ScoreableMember } from "@/features/hire/types";
import {
  evaluateDiscoverability,
  type DiscoverabilityFacts,
} from "@/features/admin/candidate-discoverability";
import {
  eligibility,
  expectedTracks,
  gateReasons,
  hasUsableProfile,
  noVisibilityRowIsProductDecision,
  type CanonicalCandidate,
} from "@/features/search-qa/canonical";
import {
  caseSpec,
  evaluateSpec,
  rankOnlyChangesAdmission,
  runCase,
  type PipelineConstants,
  type PoolSnapshot,
  type SpecCase,
} from "@/features/search-qa/compare";
import { buildCases, SEARCH_TEXT_TOKENS, seeded } from "@/features/search-qa/combinations";
import {
  DuplicateAccountDetector,
  dataQualityIssues,
  gmailLocalKey,
  healthOf,
} from "@/features/search-qa/data-quality";
import { FILTERS, specFor, type AppliedFilter } from "@/features/search-qa/filter-registry";
import {
  FAULT_FIXTURES,
  GOLDEN_COHORTS,
  GOLDEN_ENV,
  GOLDEN_FIXTURES,
  buildGoldenPool,
  goldenFixture,
  goldenPopulation,
  goldenUserId as uid,
} from "@/features/search-qa/golden";
import { documentDrift } from "@/features/search-qa/index-consistency";
import { KNOWN_ISSUES, type KnownIssueId } from "@/features/search-qa/known-issues";
import {
  citiesMatch,
  clusterValues,
  describeCityCluster,
  normalizeCity,
  normalizeWorkMode,
  skillClusterKey,
  skillMatchesToken,
} from "@/features/search-qa/normalize";
import { readinessOf } from "@/features/search-qa/types";

/* ── harness ─────────────────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;
let xfailed = 0;
const pinnedSeen = new Set<string>();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

/** Strict expected failure: reproducing is XFAIL, not reproducing is a FAIL. */
function knownBug(id: KnownIssueId, name: string, fn: () => void): void {
  pinnedSeen.add(id);
  try {
    fn();
  } catch (e) {
    xfailed += 1;
    console.log(`  ◌ ${name}  [${id} still reproduces: ${(e as Error).message.slice(0, 140)}]`);
    return;
  }
  failed += 1;
  console.log(`  ✗ ${name}\n      ${id} no longer reproduces — it looks FIXED. Remove it from known-issues.ts and turn this into a check().`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const K: PipelineConstants = { rankWindow: RANK_WINDOW, minResults: MIN_RESULTS, defaultLimit: 20 };
const POOL = buildGoldenPool(GOLDEN_FIXTURES);
const POP = goldenPopulation(false);

function poolFor(tracks: string[] = [], minEvidenceDays = 0): PoolSnapshot {
  return tracks.length || minEvidenceDays
    ? buildGoldenPool(GOLDEN_FIXTURES, { tracks, minEvidenceDays })
    : POOL;
}

function search(filters: AppliedFilter[], opts: { tracks?: string[]; minEvidenceDays?: number } = {}) {
  const tracks = opts.tracks ?? [];
  const pool = poolFor(tracks, opts.minEvidenceDays ?? 0);
  const pre: AppliedFilter[] = [];
  if (tracks.length) pre.push({ id: "tracks", value: tracks });
  if (opts.minEvidenceDays) pre.push({ id: "minEvidenceDays", value: opts.minEvidenceDays });
  return evaluateSpec(pool, specFor([...pre, ...filters]), K);
}

const skill = (...names: string[]): AppliedFilter => ({ id: "mustHaveStack", value: names });
const f = (id: string, value: AppliedFilter["value"]): AppliedFilter => ({ id, value });

function has(ev: ReturnType<typeof search>, code: string): boolean {
  return ev.admitted.has(uid(code));
}

console.log("recruiter search QA — offline suite");
console.log(
  `pipeline: rank window ${RANK_WINDOW}, min results ${MIN_RESULTS}, pool cap ${CHALLENGE_POOL_CAP}; golden candidates ${GOLDEN_FIXTURES.length} (+${FAULT_FIXTURES.length} fault injections)`,
);

/* ── normalization ───────────────────────────────────────────────────────── */

section("normalization");

check("city aliases fold only unambiguous spellings", () => {
  assert(citiesMatch("Bangalore", "Bengaluru") === "MATCH", "Bangalore = Bengaluru");
  assert(citiesMatch("banglore", "Bengaluru") === "MATCH", "banglore typo = Bengaluru");
  assert(citiesMatch("Gurgaon", "Gurugram") === "MATCH", "Gurgaon = Gurugram");
  assert(citiesMatch("New Delhi", "Delhi") === "MATCH", "New Delhi = Delhi");
  assert(citiesMatch("Delhi NCR", "Delhi") === "MATCH", "Delhi inside Delhi NCR");
  assert(citiesMatch("Noida", "Delhi NCR") === "AMBIGUOUS", "Noida vs Delhi NCR is a product decision");
  assert(citiesMatch("Noida", "Gurugram") === "AMBIGUOUS", "two NCR cities are not interchangeable");
  assert(citiesMatch("Pune", "Mumbai") === "NO_MATCH", "Pune ≠ Mumbai");
  assert(citiesMatch("Tiruvannamalai", "Una") === "NO_MATCH", "no substring city matches");
  assert(normalizeCity("Remote (India)").nonCity, "Remote (India) is not a city");
});

check("work-mode labels map to recruiter enums", () => {
  assert(normalizeWorkMode("Remote") === "REMOTE", "Remote");
  assert(normalizeWorkMode("On-site") === "ONSITE", "On-site");
  assert(normalizeWorkMode("On-Site") === "ONSITE", "On-Site");
  assert(normalizeWorkMode("Flexible") === "FLEXIBLE", "Flexible");
  assert(normalizeWorkMode("sometimes") === null, "unknown stays unknown");
});

check("skill matching: whole words, aliases, symbols never fold", () => {
  assert(skillMatchesToken("React.js", "react").literal, "react in React.js");
  assert(skillMatchesToken("React Native", "React").literal, "documented: react matches react native");
  assert(!skillMatchesToken("JavaScript", "java").literal && !skillMatchesToken("JavaScript", "java").normalized, "java ≠ JavaScript");
  assert(skillMatchesToken("Go", "golang").normalized, "golang → Go via catalog");
  assert(skillMatchesToken("Kubernetes", "k8s").normalized, "k8s → Kubernetes via catalog");
  const cpp = skillMatchesToken("C++", "C");
  assert(!cpp.literal && !cpp.normalized, "C never matches C++ (squash guard)");
  assert(!skillMatchesToken("C#", "C").normalized, "C never matches C#");
  assert(skillMatchesToken("React", "React Native").ambiguous !== null, "React for React Native is ambiguous");
});

check("clustering groups spellings and grades their safety", () => {
  const clusters = clusterValues(
    [{ raw: "Bangalore", count: 10 }, { raw: "banglore", count: 2 }, { raw: "Bengaluru", count: 1 }, { raw: "Pune", count: 3 }],
    (r) => normalizeCity(r).key,
    describeCityCluster,
  );
  assert(clusters.length === 1, `one cluster, got ${clusters.length}`);
  assert(clusters[0]!.total === 13 && clusters[0]!.safety === "SAFE_TYPO", JSON.stringify(clusters[0]));
  assert(skillClusterKey("Git & GitHub") === skillClusterKey("Git and GitHub"), "& and 'and' fold");
  assert(skillClusterKey("CSS") !== skillClusterKey("CS"), "CSS never collides with CS");
  assert(new Set(["C", "C++", "C#", "CPP"].map(skillClusterKey)).size === 3, "C, C++ and C# stay apart; CPP folds onto C++");
});

/* ── canonical eligibility ───────────────────────────────────────────────── */

section("eligibility oracle (who may appear at all)");

check("never-appear candidates fail the gate with the right reason", () => {
  const expect: [string, string][] = [
    ["QA011", "DELETED"],
    ["QA012", "DISABLED"],
    ["QA013", "WITHDRAWN"],
    ["QA014", "NOT_SEARCHABLE"],
    ["QA015", "NO_VISIBILITY_ROW"],
  ];
  for (const [code, reason] of expect) {
    const reasons = gateReasons(goldenFixture(code).canonical);
    assert(reasons.includes(reason as never), `${code} → ${reasons.join(",")}`);
  }
  assert(noVisibilityRowIsProductDecision(goldenFixture("QA015").canonical), "QA015 is the missing-row product decision");
});

check("track membership and dedupe winner follow the registry rules", () => {
  const winner = (code: string) => eligibility(goldenFixture(code).canonical, GOLDEN_ENV, GOLDEN_COHORTS).winner;
  assert(winner("QA001") === "PROGRAM", `QA001 ${winner("QA001")}`);
  assert(winner("QA003") === "CLAUDE", `QA003 ${winner("QA003")}`);
  assert(winner("QA018") === "HACKATHON", "QA018 has no claimed skill, only hackathon");
  assert(winner("QA036") === "PROFILE", "closed cohort → profile only");
  assert(winner("QA037") === "PROFILE", "9 days is below the 10-day floor");
  assert(winner("QA038") === "CHALLENGE_60", "exactly 10 days clears the floor");
  const floor30 = eligibility(goldenFixture("QA038").canonical, GOLDEN_ENV, GOLDEN_COHORTS, { minEvidenceDays: 30, tracks: ["CHALLENGE_60"] });
  assert(!floor30.eligible, "a stated 30-day floor removes a 10-day participant from the challenge track");
});

/* ── golden filter behaviour ─────────────────────────────────────────────── */

section("golden: single filters");

check("React → QA001 in; Python-only, JavaScript-only, Java-only and C-only out", () => {
  const ev = search([skill("React")]);
  assert(has(ev, "QA001"), "QA001 claims React");
  for (const code of ["QA002", "QA048", "QA050", "QA052"]) assert(!has(ev, code), `${code} must not match React`);
});

check("Python → QA002 and QA003 in, QA001 out", () => {
  const ev = search([skill("Python")]);
  assert(has(ev, "QA002") && has(ev, "QA003"), "Python candidates");
  assert(!has(ev, "QA001"), "QA001 has no Python");
});

check("required skills are AND: React + TypeScript needs both", () => {
  const ev = search([skill("React", "TypeScript")]);
  assert(has(ev, "QA047") && has(ev, "QA035"), "React+TypeScript candidates");
  assert(!has(ev, "QA040"), "React-only candidate is not admitted");
});

check("search text: case, symbols and dotted names", () => {
  assert(has(search([skill("REACT")]), "QA001"), "REACT");
  assert(has(search([skill("c++")]), "QA006"), "c++");
  assert(!has(search([skill("C")]), "QA006"), "C must not match C++");
  assert(has(search([skill("C#")]), "QA007"), "C#");
  assert(has(search([skill("node")]), "QA008"), "node → Node.js");
  assert(has(search([skill("Next.js")]), "QA009"), "Next.js");
  assert(has(search([skill("machine learning")]), "QA002"), "machine learning");
  const java = search([skill("java")]);
  assert(has(java, "QA050") && !has(java, "QA048"), "java matches Java, not JavaScript");
  assert(search([skill("qa-zero-match-skill")]).admitted.size === 0, "zero-match skill returns nobody");
});

check("catalog aliases: golang → Go, k8s → Kubernetes, nextjs → Next.js, cpp → C++", () => {
  assert(has(search([skill("golang")]), "QA005"), "golang should find QA005 (Go)");
  assert(has(search([skill("k8s")]), "QA051"), "k8s should find QA051 (Kubernetes)");
  assert(has(search([skill("nextjs")]), "QA009"), "nextjs should find QA009 (Next.js)");
  assert(has(search([skill("cpp")]), "QA006"), "cpp should find QA006 (C++)");
  assert(!has(search([skill("cpp")]), "QA052"), "cpp must not find QA052 (C)");
  assert(!has(search([skill("js")]), "QA050"), "js (JavaScript) must not find QA050 (Java)");
});

check("a compound part answers through the catalog: AI/ML is found by Machine Learning", () => {
  assert(has(search([skill("Machine Learning")]), "QA062"), "QA062 claims AI/ML");
  assert(!has(search([skill("Deep Learning")]), "QA062"), "Deep Learning is not ML");
});
check("catalog alias: reactjs requirement finds React candidates", () => {
  assert(has(search([skill("reactjs")]), "QA001"), "reactjs should find QA001 (React)");
});
check("compound skills: found whole and by any single part, never by a fragment", () => {
  const expect: [string, string, boolean][] = [
    ["UI/UX", "QA010", true],
    ["UX", "QA010", true],
    ["AI/ML", "QA062", true],
    ["ML", "QA062", true],
    ["AI", "QA062", true],
    ["C/C++", "QA063", true],
    ["C", "QA063", true],
    ["C++", "QA063", true],
    ["C#", "QA063", false],
    ["Data Structures & Algorithms", "QA064", true],
    ["Algorithms", "QA064", true],
    ["Git & GitHub", "QA065", true],
    ["Git", "QA065", true],
    ["GitHub", "QA065", true],
    ["React", "QA063", false],
    ["Java", "QA064", false],
  ];
  const wrong = expect.filter(([token, code, want]) => has(search([skill(token)]), code) !== want);
  assert(wrong.length === 0, wrong.map(([t, c, w]) => `${t} → ${c} expected ${w ? "in" : "out"}`).join("; "));
});

check("splitSkills keeps compounds and catalog names whole, still splits pastes", () => {
  const cases: [string[], string[]][] = [
    [["UI/UX"], ["UI/UX"]],
    [["C/C++"], ["C/C++"]],
    [["Git & GitHub"], ["Git & GitHub"]],
    [["UI/UX Design"], ["UI/UX Design"]],
    [["Data Structures & Algorithms"], ["Data Structures & Algorithms"]],
    [["python c++ html css js react"], ["python", "c++", "html", "css", "js", "react"]],
    [["Python | React | SQL |"], ["Python", "React", "SQL"]],
    [["HTML CSS JAVASCRIPT JAVA"], ["HTML", "CSS", "JAVASCRIPT", "JAVA"]],
    [["Python Data Structures & Algorithms (DSA) SQL Git"], ["Python Data Structures", "Algorithms", "(DSA)", "SQL", "Git"]],
    [["Machine Learning", "machine learning"], ["Machine Learning"]],
  ];
  for (const [input, want] of cases) {
    const got = splitSkills(input);
    assert(JSON.stringify(got) === JSON.stringify(want), `${JSON.stringify(input)} → ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
});

check("a pasted list with a long part still matches its pieces (unchanged)", () => {
  assert(has(search([skill("SQL")]), "QA066") && has(search([skill("Git")]), "QA066"), "QA066 pieces");
});

check("engagement type: ANY overlap, empty list = unstated", () => {
  const ev = search([skill("React"), f("employmentType", "FREELANCE")]);
  assert(has(ev, "QA023"), "freelance-only candidate in");
  assert(!has(ev, "QA022"), "internship-only candidate out");
  assert(has(ev, "QA021") && has(ev, "QA020"), "unstated / no preference row stay in");
});

check("open to work: false out, unknown availability in (documented null policy)", () => {
  const ev = search([skill("React"), f("openToWork", true)]);
  assert(!has(ev, "QA019"), "not open to work → out");
  assert(has(ev, "QA020"), "no preference row → in");
  assert(has(ev, "QA001"), "open to work → in");
});

check("notice period: 90 days out of a 30-day ask, unstated in", () => {
  const ev = search([skill("React"), f("noticePeriodDays", 30)]);
  assert(!has(ev, "QA033") && has(ev, "QA034"), "notice");
});

check("budget: ₹6L expectation out of ₹5L, in at ₹10L", () => {
  assert(!has(search([skill("React"), f("salaryMax", 500_000)]), "QA032"), "₹5L budget");
  assert(has(search([skill("React"), f("salaryMax", 1_000_000)]), "QA032"), "₹10L budget");
});

check("\"not decided\" budget (0/0) keeps a candidate with a stated expectation", () => {
  assert(has(search([skill("React"), f("salaryMax", 0)]), "QA032"), "QA032 excluded by the 0 sentinel");
});

check("work mode: On-site stays out of a REMOTE search, unstated stays in", () => {
  const ev = search([skill("React"), f("workMode", "REMOTE")]);
  assert(!has(ev, "QA025"), "On-site → out");
  assert(has(ev, "QA026"), "unstated → in");
});

check("work mode: a candidate who chose \"Remote\" is found by a REMOTE search", () => {
  assert(has(search([skill("React"), f("workMode", "REMOTE")]), "QA001"), "QA001 prefers Remote");
});
check("work mode: a \"Flexible\" candidate is found by any work-mode search", () => {
  assert(has(search([skill("React"), f("workMode", "HYBRID")]), "QA024"), "QA024 is Flexible");
});

section("golden: combinations");

check("React + Ghaziabad → QA001 in; Delhi NCR non-relocator out; relocator in", () => {
  const ev = search([skill("React"), f("locationCity", "Ghaziabad")]);
  assert(has(ev, "QA001"), "QA001 prefers Ghaziabad");
  assert(!has(ev, "QA027"), "Delhi NCR, not relocating");
  assert(has(ev, "QA030"), "willing to relocate");
});

check("React + Bangalore → QA001 excluded", () => {
  assert(!has(search([skill("React"), f("locationCity", "Bangalore")]), "QA001"), "QA001 prefers Ghaziabad");
});

check("Python + Bangalore + 2–3 years → QA002 in, and experience never excludes", () => {
  const ev = search([skill("Python"), f("locationCity", "Bangalore"), f("experience", ["2", "3"])]);
  assert(has(ev, "QA002"), "QA002 prefers Bangalore, 2 years");
  assert(has(ev, "QA039"), "a 0-year candidate with no stated cities is still admitted (experience is rank-only)");
});

check("city renames and typos fold; NCR cities do not", () => {
  assert(has(search([skill("Python"), f("locationCity", "Bengaluru")]), "QA002"), "Bangalore ↔ Bengaluru");
  assert(has(search([skill("React"), f("locationCity", "Bengaluru")]), "QA029"), "banglore ↔ Bengaluru");
  assert(!has(search([skill("React"), f("locationCity", "Noida")]), "QA027"), "Delhi NCR is not Noida");
  assert(!has(search([skill("React"), f("locationCity", "Gurugram")]), "QA028"), "Noida is not Gurugram");
});

check("skipped city (\"Any\") does not exclude candidates with stated cities", () => {
  assert(has(search([skill("React"), f("locationCity", "Any")]), "QA027"), "QA027 prefers Delhi NCR");
});

check("tracks are OR, and a closed cohort member is not in the cohort track", () => {
  const program = search([skill("React")], { tracks: ["PROGRAM"] });
  assert(has(program, "QA001") && has(program, "QA035"), "open cohort React members");
  assert(!has(program, "QA036"), "closed-cohort member is profile-only");
  const either = search([], { tracks: ["CLAUDE", "CHALLENGE_60"] });
  assert(has(either, "QA003") && has(either, "QA038"), "OR across tracks");
});

check("evidence-day floor: 9 out, 10 in, and a stated 30 removes the 10-day participant", () => {
  const sixty = search([], { tracks: ["CHALLENGE_60"] });
  assert(has(sixty, "QA038") && !has(sixty, "QA037"), "floor boundary");
  assert(!has(search([], { tracks: ["CHALLENGE_60"], minEvidenceDays: 30 }), "QA038"), "stated floor");
});

check("boundaries: impossible → nobody, exactly one → one, no filters → every eligible candidate", () => {
  const impossible = search([skill("React", "Python")], { tracks: ["CLAUDE"] });
  assert(impossible.admitted.size === 0 && impossible.page.length === 0, `impossible returned ${impossible.admitted.size}`);
  const one = search([skill("C#")]);
  assert(one.admitted.size === 1 && has(one, "QA007"), `C# returned ${[...one.admitted].join(",")}`);
  const all = search([]);
  const eligible = POP.filter((c) => eligibility(c, GOLDEN_ENV, GOLDEN_COHORTS).eligible).map((c) => c.userId);
  assert(eligible.every((id) => all.admitted.has(id)), "every eligible candidate is admitted with no filters");
  assert(all.admitted.size === eligible.length, `admitted ${all.admitted.size} vs eligible ${eligible.length}`);
});

/* ── ranking (separate from filtering) ───────────────────────────────────── */

section("ranking");

check("rank-only fields never change who is admitted", () => {
  const base: SpecCase = {
    id: "rank-invariance",
    kind: "PAIR",
    filters: [skill("React")],
    tracks: [],
    minEvidenceDays: 0,
    criticality: "CORE",
    rankOnly: [f("experience", ["5", "10"]), f("seniority", "SENIOR"), f("niceToHaveStack", ["TypeScript"]), f("evidencePriority", ["projects"])],
  };
  const flipped = rankOnlyChangesAdmission(POOL, base, K);
  assert(flipped.length === 0, `admission flipped for ${flipped.join(", ")}`);
});

check("in-band experience ranks above out-of-band for otherwise identical candidates", () => {
  const ev = search([skill("Python"), f("experience", ["2", "3"])]);
  const r2 = ev.byUser.get(uid("QA002"))!;
  const r43 = ev.byUser.get(uid("QA043"))!;
  assert(r2.scoreBreakdown.experience! > r43.scoreBreakdown.experience!, `${r2.scoreBreakdown.experience} vs ${r43.scoreBreakdown.experience}`);
});

check("STRONG tier is unreachable without verified work", () => {
  const ev = search([skill("React")]);
  assert(ev.byUser.get(uid("QA040"))!.tier !== "STRONG", "declared skills alone never read STRONG");
  assert(ev.byUser.get(uid("QA035"))!.tier === "STRONG", `cohort graduate is STRONG (got ${ev.byUser.get(uid("QA035"))!.tier})`);
});

knownBug("QA-KI-008", "evidence-backed cohort graduate (B) ranks above a declared-skills-only profile (A)", () => {
  const ev = search([skill("React")]);
  const pos = (code: string) => ev.ranked.findIndex((r) => r.userId === uid(code));
  const a = ev.byUser.get(uid("QA040"))!;
  const b = ev.byUser.get(uid("QA035"))!;
  assert(pos("QA035") < pos("QA040"), `B #${pos("QA035") + 1} (${b.score}, ${b.tier}) vs A #${pos("QA040") + 1} (${a.score}, ${a.tier})`);
});

/* ── pagination ──────────────────────────────────────────────────────────── */

section("pagination (top-N; the search API has no page / cursor)");

check("the search contract carries no page, offset or cursor", () => {
  const keys = Object.keys(jobSpecSchema.shape);
  for (const k of ["page", "offset", "cursor", "pageSize"]) assert(!keys.includes(k), `unexpected ${k}`);
});

check("page size honours limit and resultLimit, never duplicates, and is a subset of admitted", () => {
  const cases = buildCases({ skills: ["React", "Python", "JavaScript"], cities: ["Ghaziabad", "Bangalore"], tracks: ["PROGRAM", "PROFILE", "HACKATHON", "CLAUDE", "CHALLENGE_60"] });
  for (const c of cases) {
    const ev = evaluateSpec(poolFor(c.tracks, c.minEvidenceDays), caseSpec(c), K);
    assert(ev.page.length <= 20, `${c.id}: page ${ev.page.length}`);
    const ids = ev.page.map((p) => p.userId);
    assert(new Set(ids).size === ids.length, `${c.id}: duplicate on page`);
    for (const p of ev.page) {
      assert(!p.hardFiltered, `${c.id}: hard-filtered candidate on page`);
      assert(ev.admitted.has(p.userId), `${c.id}: page item not admitted`);
    }
  }
  const one = evaluateSpec(POOL, specFor([f("resultLimit", 1)]), K);
  assert(one.page.length === 1, `resultLimit 1 → ${one.page.length}`);
  const three = evaluateSpec(POOL, specFor([skill("React"), f("resultLimit", 3)]), K);
  assert(three.page.length === 3, `resultLimit 3 → ${three.page.length}`);
});

check("ordering is deterministic regardless of load order", () => {
  const spec = specFor([skill("React")]);
  const a = evaluateSpec(POOL, spec, K).page.map((p) => p.userId).join(",");
  const rand = seeded(7);
  const shuffled: PoolSnapshot = { ...POOL, members: [...POOL.members].sort(() => rand() - 0.5) };
  const b = evaluateSpec(shuffled, spec, K).page.map((p) => p.userId).join(",");
  assert(a === b, "page order changed when the pool was loaded in a different order");
});

check("a thin shortlist is padded to the minimum with the next best people (no must-haves)", () => {
  const ev = evaluateSpec(buildGoldenPool(GOLDEN_FIXTURES, { tracks: ["CLAUDE"] }), specFor([]), K);
  assert(ev.page.length === ev.admitted.size, "every admitted candidate is shown when the pool is smaller than the page");
});

function challengeMember(i: number, skills: string[], submissions: number, streak: number): ScoreableMember {
  return {
    id: `win_${i}`,
    source: "CLAUDE",
    candidateRef: `CLAUDE:win_${i}`,
    userId: `win_${i}`,
    fullName: "",
    jobRole: "",
    company: "",
    yearsExperience: 0,
    skills,
    missionPoints: 0,
    missionsPassed: submissions,
    missionsAttempted: submissions,
    cleanPassCount: 0,
    totalScore: 0,
    commitDayCount: streak,
    projectScores: [],
    interview: null,
    hasVisibilityConsent: true,
    cohortPublished: true,
    status: "ENROLLED",
    availability: null,
    cohortDay: 60,
    maxEarnableMissions: 60,
    consistencyWindow: 60,
    coverage: {
      dimensions: { stack: true, experience: true, missions: true, consistency: true, cleanPass: false, projects: false, interview: false },
      note: "challenge",
    },
  };
}

const WINDOW_POOL: PoolSnapshot = {
  key: "window",
  members: [
    ...Array.from({ length: RANK_WINDOW + 10 }, (_, i) => challengeMember(i, ["Python"], 60, 60)),
    ...Array.from({ length: 3 }, (_, i) => challengeMember(1000 + i, ["React"], 10, 1)),
  ],
  coverage: { dimensions: { stack: true, experience: true, missions: true, consistency: true, cleanPass: false, projects: false, interview: false }, note: "" },
  loads: [],
  duplicateUserIds: [],
};

check("rank-window loss is detected and named by the engine", () => {
  const ev = evaluateSpec(WINDOW_POOL, specFor([skill("React")]), K);
  assert(ev.admitted.size === 3, `3 React candidates admitted, got ${ev.admitted.size}`);
  assert(ev.pageWithoutWindow.length === 3, "without the window all three would be shown");
});

knownBug("QA-KI-006", "matching candidates outranked by 100+ non-matching ones still reach the page", () => {
  const ev = evaluateSpec(WINDOW_POOL, specFor([skill("React")]), K);
  assert(ev.page.length === 3, `recruiter sees ${ev.page.length} of 3 React candidates`);
});

/* ── sort ────────────────────────────────────────────────────────────────── */

section("sort (one order: score desc, then name / ref asc)");

check("every ranking is score-descending with a stable tiebreak, and the page keeps rank order", () => {
  for (const spec of [specFor([]), specFor([skill("React")]), specFor([skill("Python"), f("experience", ["2", "5"])])]) {
    const ev = evaluateSpec(POOL, spec, K);
    for (let i = 1; i < ev.ranked.length; i++) {
      const a = ev.ranked[i - 1]!;
      const b = ev.ranked[i]!;
      assert(a.score >= b.score, `score order broken at ${i}`);
      if (a.score === b.score) {
        assert((a.fullName || a.candidateRef).localeCompare(b.fullName || b.candidateRef) <= 0, `tiebreak broken at ${i}`);
      }
    }
    const order = ev.ranked.map((r) => r.userId);
    const pagePositions = ev.page.map((p) => order.indexOf(p.userId));
    assert(pagePositions.every((p, i) => i === 0 || p > pagePositions[i - 1]!), "page is not in rank order");
  }
});

/* ── privacy ─────────────────────────────────────────────────────────────── */

section("privacy and visibility");

const NEVER = ["QA011", "QA012", "QA013", "QA014", "QA015"].map(uid);

check("deleted / disabled / withdrawn / hidden / no-row candidates never appear in any generated search", () => {
  const cases = buildCases({ skills: ["React", "Python"], cities: ["Ghaziabad", "Delhi NCR"], tracks: ["PROGRAM", "PROFILE", "HACKATHON", "CLAUDE", "CHALLENGE_60"] });
  for (const c of cases) {
    const ev = evaluateSpec(poolFor(c.tracks, c.minEvidenceDays), caseSpec(c), K);
    for (const id of NEVER) {
      assert(!ev.admitted.has(id) && !ev.page.some((p) => p.userId === id), `${id} leaked into ${c.id}`);
    }
  }
});

check("a card never carries contact data (ScoredCandidate has no email / phone / URL fields)", () => {
  const ev = evaluateSpec(POOL, specFor([skill("React")]), K);
  const json = JSON.stringify(ev.page);
  assert(!/@|https?:\/\/|github\.com|linkedin\.com/i.test(json), "contact-looking value on a result");
});

/* ── classifier self-tests (fault injection) ─────────────────────────────── */

section("classifier self-tests (every failure is named correctly)");

const FAULT_POOL = buildGoldenPool([...GOLDEN_FIXTURES, ...FAULT_FIXTURES]);
const FAULT_POP = goldenPopulation(true);

function faultCase(filters: AppliedFilter[], id: string) {
  return runCase(
    { id, kind: "SINGLE", filters, tracks: [], minEvidenceDays: 0, criticality: "CORE" },
    FAULT_POOL,
    FAULT_POP,
    GOLDEN_ENV,
    GOLDEN_COHORTS,
    K,
  ).result;
}

function findingFor(result: ReturnType<typeof faultCase>, userId: string) {
  return result.findings.find((x) => x.userIds.includes(userId));
}

check("stale document (canonical Python, document React) → SEARCH_INDEX_STALE, search FAIL", () => {
  const r = faultCase([skill("React")], "fault-stale");
  const hit = findingFor(r, uid("QA053"));
  assert(hit?.category === "SEARCH_INDEX_STALE" && hit.searchVerdict === "FAIL", JSON.stringify(hit));
});

check("deleted user present in the pool → VISIBILITY_ERROR, CRITICAL", () => {
  const r = faultCase([skill("React")], "fault-visibility");
  const hit = findingFor(r, uid("QA054"));
  assert(hit?.category === "VISIBILITY_ERROR" && hit.severity === "CRITICAL", JSON.stringify(hit));
  assert(readinessOf(r.findings).readiness === "NOT_READY", "a leak blocks readiness");
});

check("eligible candidate the loader dropped → SEARCH_INDEX_MISSING", () => {
  const r = faultCase([skill("React")], "fault-missing");
  assert(findingFor(r, uid("QA055"))?.category === "SEARCH_INDEX_MISSING", JSON.stringify(findingFor(r, uid("QA055"))));
});

check("document availability drift → SEARCH_INDEX_STALE on the work-mode filter", () => {
  const r = faultCase([f("workMode", "REMOTE")], "fault-availability");
  const hit = findingFor(r, uid("QA057"));
  assert(hit?.category === "SEARCH_INDEX_STALE" && hit.detail?.cause === "AVAILABILITY_DRIFT", JSON.stringify(hit));
});

check("track loaded to its cap → PAGINATION_ERROR (POOL_CAP), not a filter failure", () => {
  const capped = buildGoldenPool(GOLDEN_FIXTURES, { caps: { PROFILE: 5 } });
  const r = runCase({ id: "cap", kind: "SINGLE", filters: [skill("React")], tracks: [], minEvidenceDays: 0, criticality: "CORE" }, capped, POP, GOLDEN_ENV, GOLDEN_COHORTS, K).result;
  const cap = r.findings.find((x) => x.detail?.cause === "POOL_CAP");
  assert(cap?.category === "PAGINATION_ERROR" && cap.affected > 0, JSON.stringify(r.findings.map((x) => x.detail?.cause)));
});

check("bad data on a correctly returned candidate → DATA_QUALITY_ERROR with search PASS", () => {
  const r = faultCase([skill("React")], "fault-dq");
  const dq = r.findings.find((x) => x.category === "DATA_QUALITY_ERROR" && x.userIds.includes(uid("QA058")));
  assert(dq?.searchVerdict === "PASS", JSON.stringify(dq));
});

function goldenCase(filters: AppliedFilter[], id: string) {
  return runCase({ id, kind: "SINGLE", filters, tracks: [], minEvidenceDays: 0, criticality: "CORE" }, POOL, POP, GOLDEN_ENV, GOLDEN_COHORTS, K).result;
}

check("pasted skill list matched after splitting → DATA_QUALITY_ERROR, search PASS", () => {
  // "react.js" is not inside "python c++ html css js react", but the split piece "react" matches it.
  const r = goldenCase([skill("React.js")], "data-pasted");
  const hit = findingFor(r, uid("QA059"));
  assert(hit?.category === "DATA_QUALITY_ERROR" && hit.searchVerdict === "PASS" && hit.detail?.cause === "PASTED_SKILL_LIST", JSON.stringify(hit));
});

check("cohort member with no canonical skills matched on application skills → DATA_QUALITY_ERROR, search PASS", () => {
  const r = goldenCase([skill("Python")], "data-cohort");
  const hit = findingFor(r, uid("QA060"));
  assert(hit?.category === "DATA_QUALITY_ERROR" && hit.searchVerdict === "PASS" && hit.detail?.cause === "CANONICAL_PROFILE_MISSING_COHORT_SKILLS", JSON.stringify(hit));
  assert(r.status !== "FAIL", `a data-explained case must not FAIL (got ${r.status})`);
});

check("known-issue failures classify under their pinned issue", () => {
  const { result } = runCase(
    { id: "ki-classify", kind: "SINGLE", filters: [skill("React")], tracks: [], minEvidenceDays: 0, criticality: "CORE" },
    WINDOW_POOL,
    [],
    GOLDEN_ENV,
    GOLDEN_COHORTS,
    K,
  );
  const hit = result.findings.find((x) => x.detail?.cause === "RANK_WINDOW");
  assert(hit?.knownIssue === "QA-KI-006" && hit.category === "PAGINATION_ERROR", JSON.stringify(hit));
});

check("withdrawn-but-evidenced skill match is a product decision, not a failure", () => {
  const r = faultCase([skill("React")], "fault-unclaimed");
  const hit = findingFor(r, uid("QA018"));
  assert(hit?.productDecision === true && hit.detail?.cause === "UNCLAIMED_SKILL_MATCHED", JSON.stringify(hit));
});

/* ── golden regression over every generated combination ──────────────────── */

section("golden regression: every generated case over the golden pool");

check("no unexplained FAIL in any single / pair / triple / complex / random case", () => {
  const cases = buildCases(
    { skills: ["React", "Python", "JavaScript", "Java"], cities: ["Ghaziabad", "Bangalore", "Delhi NCR"], tracks: ["PROGRAM", "CLAUDE", "CHALLENGE_60", "HACKATHON", "PROFILE"] },
    { seed: 42, randomCount: 40 },
  );
  const unexplained: string[] = [];
  const byStatus: Record<string, number> = {};
  for (const c of cases) {
    const { result } = runCase(c, poolFor(c.tracks, c.minEvidenceDays), POP, GOLDEN_ENV, GOLDEN_COHORTS, K);
    byStatus[result.status] = (byStatus[result.status] ?? 0) + 1;
    for (const fnd of result.findings) {
      if (fnd.searchVerdict === "FAIL" && !fnd.knownIssue && !fnd.productDecision && fnd.severity !== "INFO") {
        unexplained.push(`${c.id} ${fnd.category} ${String(fnd.detail?.cause)} [${fnd.userIds.slice(0, 3).join(",")}] ${fnd.message.slice(0, 120)}`);
      }
    }
  }
  console.log(`      ${cases.length} cases: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  assert(unexplained.length === 0, `\n        ${unexplained.slice(0, 12).join("\n        ")}`);
});

check("combination generator is reproducible and covers every value pair", () => {
  const stats = { skills: ["React", "Python"], cities: ["A", "B"], tracks: ["PROFILE"] };
  const a = buildCases(stats, { seed: 1 }).map((c) => `${c.id}:${JSON.stringify(c.filters)}`).join("|");
  const b = buildCases(stats, { seed: 1 }).map((c) => `${c.id}:${JSON.stringify(c.filters)}`).join("|");
  assert(a === b, "same seed produced different cases");
  const complex = buildCases(stats, { seed: 1 }).filter((c) => c.kind === "COMPLEX");
  assert(complex.every((c) => c.filters.length >= 5), "complex cases carry 5+ filters");
  const pairs = new Set<string>();
  for (const c of complex) {
    for (let i = 0; i < c.filters.length; i++) {
      for (let j = i + 1; j < c.filters.length; j++) {
        pairs.add(`${c.filters[i]!.id}=${JSON.stringify(c.filters[i]!.value)}|${c.filters[j]!.id}=${JSON.stringify(c.filters[j]!.value)}`);
      }
    }
  }
  // 7 dimensions, value counts [2,2,2,2,1,2,2] → Σ over pairs of |Vi|·|Vj|.
  const counts = [2, 2, 2, 2, 1, 2, 2];
  let expected = 0;
  for (let i = 0; i < counts.length; i++) for (let j = i + 1; j < counts.length; j++) expected += counts[i]! * counts[j]!;
  assert(pairs.size === expected, `covering array covers ${pairs.size}/${expected} pairs`);
});

/* ── index consistency ───────────────────────────────────────────────────── */

section("search document vs canonical profile");

function driftOf(code: string) {
  const member = POOL.members.find((m) => m.userId === uid(code));
  assert(member, `${code} not in pool`);
  return documentDrift(goldenFixture(code).canonical, member);
}

check("a clean profile has no document drift", () => {
  assert(driftOf("QA002").length === 0, JSON.stringify(driftOf("QA002")));
});

check("compound claims reach the search document whole — no split drift", () => {
  for (const code of ["QA010", "QA062", "QA063", "QA064", "QA065"]) {
    assert(!driftOf(code).some((d) => d.cause === "LOADER_SPLIT_SKILL"), `${code}: ${JSON.stringify(driftOf(code))}`);
  }
});

check("the drift detector still names a split catalog skill if one ever returns", () => {
  const member = POOL.members.find((m) => m.userId === uid("QA064"))!;
  const drift = documentDrift(goldenFixture("QA064").canonical, { ...member, skills: ["Data Structures", "Algorithms"] });
  assert(drift.some((d) => d.cause === "LOADER_SPLIT_SKILL"), JSON.stringify(drift));
});

check("a graduation year hidden by a year-less education row is still detected if it ever returns", () => {
  // The loader now orders NULLS LAST, so QA056's document carries 2024 and the
  // pool is clean. The detector still has to name the old shape on sight.
  assert(driftOf("QA056").length === 0, `QA056 should have no drift: ${JSON.stringify(driftOf("QA056"))}`);
  const member = POOL.members.find((m) => m.userId === uid("QA056"))!;
  const stale = {
    ...member,
    dossier: { ...member.dossier!, education: { ...member.dossier!.education, value: { level: null, university: null, gradYear: null } } },
  };
  const drift = documentDrift(goldenFixture("QA056").canonical, stale);
  assert(drift.some((d) => d.cause === "NULLS_FIRST_EDUCATION_PICK"), JSON.stringify(drift));
});

check("document graduation year equals the candidate's latest entered year (NULLS LAST)", () => {
  const member = POOL.members.find((m) => m.userId === uid("QA056"))!;
  assert(member.dossier?.education.value.gradYear === 2024, `document gradYear ${member.dossier?.education.value.gradYear}`);
});

/* ── data quality ────────────────────────────────────────────────────────── */

section("data quality (audited, never a search verdict)");

function rules(code: string): string[] {
  return dataQualityIssues(goldenFixture(code).canonical).map((i) => i.rule);
}

check("each seeded defect is detected by its rule", () => {
  const expect: [string, string][] = [
    ["QA041", "TEST_ACCOUNT_SEARCHABLE"],
    ["QA042", "NAME_PLACEHOLDER"],
    ["QA043", "GRAD_YEAR_OUT_OF_RANGE"],
    ["QA044", "EXPERIENCE_NEGATIVE"],
    ["QA045", "GITHUB_INVALID"],
    ["QA016", "NON_CANDIDATE_ROLE_SEARCHABLE"],
    ["QA015", "VISIBILITY_ROW_MISSING"],
    ["QA029", "LOCATION_UNNORMALIZED"],
    ["QA058", "SKILL_DUPLICATE_SPELLING"],
  ];
  for (const [code, rule] of expect) assert(rules(code).includes(rule), `${code} → [${rules(code).join(", ")}]`);
  assert(!rules("QA025").includes("WORK_MODE_INVALID"), "On-site is a valid picker value");
  assert(healthOf(dataQualityIssues(goldenFixture("QA041").canonical)) === "INVALID", "test account is invalid");
});

check("duplicate accounts are found by GitHub identity and Gmail aliasing", () => {
  const d = new DuplicateAccountDetector();
  for (const c of POP) d.observe(c);
  assert(d.duplicates().some((x) => x.userIds.includes(uid("QA002")) && x.userIds.includes(uid("QA046"))), "QA002 / QA046 share a GitHub");
  assert(gmailLocalKey("a.b+jobs@gmail.com") === gmailLocalKey("ab@gmail.com"), "gmail dots and tags fold");
  assert(gmailLocalKey("a.b@outlook.com") === null, "other providers are not folded");
});

/* ── Scout's free-text parser ────────────────────────────────────────────── */

section("search text parsing (Scout's deterministic stack extraction)");

check("case-insensitive extraction of the supported stack words", () => {
  assert(extractPoolBrief("need a REACT developer").mustHaveStack.includes("react"), "REACT");
  const ps = extractPoolBrief("python and sql people").mustHaveStack;
  assert(ps.includes("python") && ps.includes("sql"), ps.join(","));
  assert(extractPoolBrief("node.js dev").mustHaveStack.includes("node"), "node.js → node");
  assert(!extractPoolBrief("javascript engineer").mustHaveStack.includes("java"), "javascript ≠ java");
});

knownBug("QA-KI-010", "\"need a c++ developer\" extracts c++", () => {
  const stack = extractPoolBrief("need a c++ developer").mustHaveStack;
  assert(stack.includes("c++"), `got [${stack.join(", ")}]`);
});

/* ── persisted results (saved match lists) ───────────────────────────────── */

section("persisted results");

knownBug("QA-KI-007", "saved PROFILE matches keep a PROFILE ref (source scan of loadRequestMatches)", () => {
  const src = readFileSync(join(process.cwd(), "src/features/hire/load-request-matches.ts"), "utf8");
  const block = src.slice(src.indexOf("candidateRef: encodeCandidateRef("), src.indexOf("programMemberId: m.programMemberId"));
  assert(/PROFILE|isKnownTrack|findTrack/.test(block), "any source outside the four legacy slugs is rewritten to CLAUDE");
});

/* ── admin discoverability panel vs the loaders ───────────────────────────── */

section("admin \"Recruiter search\" panel agrees with search eligibility");

function discoverabilityFacts(c: CanonicalCandidate): DiscoverabilityFacts {
  const gatePass = gateReasons(c).length === 0;
  const at = new Date("2026-09-01T00:00:00.000Z");
  return {
    deletedAt: c.deleted ? at : null,
    anonymizedAt: c.anonymized ? at : null,
    disabledAt: c.disabled ? at : null,
    disabledReason: null,
    sessionInvalidatedAt: null,
    gate: {
      exists: c.visibility != null,
      searchableByRecruiters: c.visibility?.searchable ?? false,
      withdrawnAt: c.visibility?.withdrawn ? at : null,
    },
    passesSearchGate: gatePass,
    profile: {
      exists: c.profile != null,
      fullName: c.profile?.fullName ?? "",
      headline: c.profile?.headline ?? null,
      locationCity: c.profile?.locationCity ?? null,
      countryCode: null,
      educationCount: c.education.length,
      experienceCount: c.experience.length,
      hasNoWorkExperience: false,
    },
    skills: {
      claimed: c.skills.filter((sk) => sk.claimed).length,
      withEvidence: c.skills.filter((sk) => sk.evidenceCount > 0).length,
    },
    inProfilePool: gatePass && hasUsableProfile(c),
    profilePoolAhead: 0,
    profilePoolCap: CHALLENGE_POOL_CAP,
    tracks: {
      challengeWithSubmissions: c.memberships.challenge.filter((e) => e.submissions > 0).length,
      programMemberships: c.memberships.program.length,
      hackathonWithSubmission: c.memberships.hackathonWithSubmission ? 1 : 0,
    },
  };
}

check("the panel's verdict matches the loaders for every fixture the two rule sets agree on", () => {
  // Excludes the fixtures pinned below, so a NEW disagreement still fails CI.
  const pinned = new Set(["QA061"]);
  const wrong = GOLDEN_FIXTURES.filter((fx) => !pinned.has(fx.code)).filter(
    (fx) => evaluateDiscoverability(discoverabilityFacts(fx.canonical)).appears !==
      eligibility(fx.canonical, GOLDEN_ENV, GOLDEN_COHORTS).eligible,
  );
  assert(wrong.length === 0, `panel disagrees on ${wrong.map((fx) => fx.code).join(", ")}`);
});

knownBug("QA-KI-011", "a sub-floor challenge participant with no usable profile is not reported as appearing", () => {
  const c = goldenFixture("QA061").canonical;
  assert(!eligibility(c, GOLDEN_ENV, GOLDEN_COHORTS).eligible, "oracle: no loader returns QA061");
  const panel = evaluateDiscoverability(discoverabilityFacts(c));
  assert(!panel.appears, `panel verdict: "${panel.verdict}"`);
});

knownBug("QA-KI-011", "the panel never names a track the loaders do not load (closed cohort, sub-floor challenge)", () => {
  for (const code of ["QA036", "QA037"]) {
    const c = goldenFixture(code).canonical;
    const detail = evaluateDiscoverability(discoverabilityFacts(c)).checks.find((x) => x.id === "track-pools")?.detail ?? "";
    const loaded = expectedTracks(c, GOLDEN_ENV, GOLDEN_COHORTS);
    const claimsChallenge = /challenge pool/.test(detail);
    const claimsCohort = /AI cohort pool/.test(detail);
    assert(!claimsChallenge || loaded.some((t) => t === "CLAUDE" || t === "CHALLENGE_60"), `${code}: "${detail.slice(0, 90)}"`);
    assert(!claimsCohort || loaded.includes("PROGRAM"), `${code}: "${detail.slice(0, 90)}"`);
  }
});

/* ── registry integrity ──────────────────────────────────────────────────── */

section("registry integrity");

check("every filter in the inventory is well-formed", () => {
  for (const def of FILTERS) {
    if (def.kind === "HARD_FILTER" || def.kind === "MATCH_GATE") {
      assert(def.apply && def.oracle && def.service && def.diagnose, `${def.id} is missing a decidable half`);
    }
    if (def.kind !== "NOT_IMPLEMENTED") assert(def.apply, `${def.id} cannot be applied`);
  }
  const spec: JobSpec = specFor([skill("React"), f("workMode", "REMOTE"), f("salaryMax", 0)]);
  assert(jobSpecSchema.safeParse(spec).success, "generated specs are valid JobSpecs");
});

check("every known issue is pinned by at least one test", () => {
  const unpinned = Object.keys(KNOWN_ISSUES).filter((id) => !pinnedSeen.has(id));
  assert(unpinned.length === 0, `unpinned: ${unpinned.join(", ")}`);
});

void SEARCH_TEXT_TOKENS;

console.log(`\n${passed} passed, ${failed} failed, ${xfailed} known issue(s) still reproducing\n`);
if (xfailed > 0) {
  console.log("Recruiter search is NOT production-ready while known issues reproduce (see known-issues.ts).\n");
}
if (failed > 0) process.exit(1);
