/**
 * T-266 admin evidence provenance. Run with:
 *   npm run test:evidence-provenance
 *
 * No network, no database. Acceptance: every evidence badge is traceable to a
 * real source activity with a date, and nothing is fabricated.
 *
 *  1. A badge whose source row exists, belongs to the candidate and still meets
 *     its writer's bar is traced — named and dated FROM THAT ROW.
 *  2. Every other badge is untraced and says why. No placeholder name, no
 *     placeholder date, no borrowed snapshot label.
 *  3. The admin card only calls a skill "Evidence-backed" when a source traced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allItems,
  buildEvidenceProvenance,
  collectSourceIds,
  tracedCount,
  type EvidenceSourceRows,
  type ProvenanceItem,
} from "@/features/admin/evidence-provenance";

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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const code = (rel: string) =>
  stripComments(readFileSync(join(process.cwd(), rel), "utf8"));

const ME = "user_me";
const OTHER = "user_other";
const D = (iso: string) => new Date(iso);

function empty(): EvidenceSourceRows {
  return {
    evidence: [],
    credentials: [],
    achievements: [],
    programmeSkills: [],
    scores: [],
    evaluations: [],
    linkedCredentials: [],
    enrollments: [],
    participants: [],
    teams: [],
    workshops: [],
    certificates: [],
    reports: [],
  };
}

function only(items: ProvenanceItem[]): ProvenanceItem {
  assert(items.length === 1, `expected one item, got ${items.length}`);
  return items[0]!;
}

function tracedOrThrow(item: ProvenanceItem) {
  if (!item.traced) throw new Error(`expected traced, got: ${item.reason}`);
  return item.source;
}

function untracedOrThrow(item: ProvenanceItem) {
  if (item.traced) throw new Error(`expected untraced, got source ${item.source.name}`);
  return item;
}

/** The candidate in the screenshot: two hackathon credentials, three achievements. */
function screenshotCandidate(): EvidenceSourceRows {
  const team = {
    id: "team_1",
    eventId: "legacy",
    teamName: "Byte Ninjas",
    candidateJoinedAt: D("2026-08-01T06:00:00Z"),
    submission: { createdAt: D("2026-08-10T12:00:00Z"), problem: { title: "Campus lost & found" } },
  };
  return {
    ...empty(),
    credentials: [
      {
        id: "cred_cert_a",
        credentialId: "ABT-HK-2345A",
        type: "PARTICIPATION",
        sourceType: "HACKATHON_TEAM",
        sourceKey: "team_1:cert_a",
        title: "HACKATHON",
        metadata: { teamId: "team_1" },
        issuedAt: D("2026-08-14T04:00:00Z"),
      },
      {
        id: "cred_cert_b",
        credentialId: "ABT-HK-2345B",
        type: "PLACEMENT",
        sourceType: "HACKATHON_TEAM",
        sourceKey: "team_1:cert_b",
        title: "HACKATHON",
        metadata: { teamId: "team_1", hackathonVariant: "second" },
        issuedAt: D("2026-08-14T04:00:00Z"),
      },
    ],
    achievements: [
      { id: "ach_1", sourceType: "CREDENTIAL", sourceId: "cred_cert_a", title: "HACKATHON", outcomeLabel: "PARTICIPATION" },
      { id: "ach_2", sourceType: "CREDENTIAL", sourceId: "cred_cert_b", title: "HACKATHON", outcomeLabel: "PLACEMENT" },
      { id: "ach_3", sourceType: "HACKATHON_TEAM", sourceId: "hp_1", title: "ViCoDathon 2026", outcomeLabel: "Participant" },
    ],
    teams: [team],
    participants: [
      {
        id: "hp_1",
        userId: ME,
        createdAt: D("2026-08-01T06:00:00Z"),
        team: { eventId: team.eventId, teamName: team.teamName, submission: team.submission },
      },
    ],
    certificates: [
      { id: "cert_a", userId: ME, type: "HACKATHON", status: "ISSUED", issuedAt: D("2026-08-14T04:00:00Z"), metadata: { teamId: "team_1" } },
      { id: "cert_b", userId: ME, type: "HACKATHON", status: "ISSUED", issuedAt: D("2026-08-14T04:00:00Z"), metadata: { teamId: "team_1" } },
    ],
  };
}

console.log("\nT-266 admin evidence provenance\n");

/* ── the screenshot, traced ──────────────────────────────────────────────── */

suite("hackathon credentials trace to the team and its submission date", () => {
  const p = buildEvidenceProvenance(ME, screenshotCandidate());
  assert(p.credentials.length === 2, "both credentials listed");
  for (const c of p.credentials) {
    const s = tracedOrThrow(c.item);
    assert(s.kind === "HACKATHON", s.kind);
    assert(s.name === "ViCoDathon 2026 · Team Byte Ninjas", `name came from the row: ${s.name}`);
    assert(s.name !== "HACKATHON", "the raw credential title is never the source name");
    assert(s.earnedAt.toISOString() === "2026-08-10T12:00:00.000Z", "dated by the submission");
    assert(s.dateBasis === "Submitted", s.dateBasis);
    assert(s.record === "HackathonTeam · team_1", s.record);
  }
  const placement = p.credentials.find((c) => c.credentialId === "ABT-HK-2345B");
  assert(placement?.typeLabel === "2nd place", `placement label: ${placement?.typeLabel}`);
});

suite("every achievement in the screenshot is traced with a date", () => {
  const p = buildEvidenceProvenance(ME, screenshotCandidate());
  assert(p.achievements.length === 3, "all three achievements listed");
  for (const a of p.achievements) {
    const s = tracedOrThrow(a);
    assert(s.earnedAt instanceof Date && !Number.isNaN(s.earnedAt.getTime()), "real date");
  }
  const viaCredential = tracedOrThrow(p.achievements[0]!);
  assert(
    viaCredential.detail?.includes("Credential ABT-HK-2345A") === true,
    `a credential-backed achievement names the credential: ${viaCredential.detail}`,
  );
  const direct = tracedOrThrow(p.achievements[2]!);
  assert(direct.record === "HackathonParticipant · hp_1", direct.record);
});

suite("acceptance: every item on a fully-backed candidate is traced and dated", () => {
  const items = allItems(buildEvidenceProvenance(ME, screenshotCandidate()));
  assert(items.length === 5, `expected 5 badges, got ${items.length}`);
  for (const item of items) {
    const s = tracedOrThrow(item);
    assert(s.name.trim().length > 0, "named");
    assert(s.dateBasis.trim().length > 0, "the date says what it is");
    assert(s.record.includes(" · "), "points at a table and id");
  }
});

/* ── names and dates come from the source, not the badge ─────────────────── */

suite("a lying snapshot label does not change the source name", () => {
  const rows = screenshotCandidate();
  rows.achievements[2] = { ...rows.achievements[2]!, title: "Winner of everything", outcomeLabel: null };
  const s = tracedOrThrow(buildEvidenceProvenance(ME, rows).achievements[2]!);
  assert(s.name === "ViCoDathon 2026 · Team Byte Ninjas", s.name);
  assert(
    buildEvidenceProvenance(ME, rows).achievements[2]!.storedLabel === "Winner of everything",
    "the snapshot is kept only for comparison",
  );
});

suite("assessment score evidence is named by report and dimension, dated by assessment", () => {
  const rows: EvidenceSourceRows = {
    ...empty(),
    evidence: [{ id: "se_1", sourceType: "ASSESSMENT_SCORE", sourceId: "as_1", sourceLabel: "old label", skillId: "sk_py", skillName: "Python" }],
    scores: [
      {
        id: "as_1",
        dimension: "technical",
        score: 82,
        maxScore: 100,
        createdAt: D("2026-07-02T00:00:00Z"),
        report: { title: "AI Cohort interview", candidateUserId: ME, assessedAt: D("2026-07-01T09:00:00Z") },
      },
    ],
  };
  const skill = buildEvidenceProvenance(ME, rows).skills[0]!;
  const s = tracedOrThrow(only(skill.items));
  assert(s.kind === "ASSESSMENT", s.kind);
  assert(s.name === "AI Cohort interview · technical", s.name);
  assert(s.detail === "Score 82/100", String(s.detail));
  assert(s.dateBasis === "Assessed" && s.earnedAt.toISOString() === "2026-07-01T09:00:00.000Z", "assessed date wins");
  assert(tracedCount(skill.items) === 1, "counted");
});

suite("cohort and challenge activity evidence carry programme, day and submission date", () => {
  const base = {
    id: "ev_1",
    passed: true,
    isAuthoritative: true,
    score: 9,
    maxScore: 10,
    createdAt: D("2026-08-03T00:00:00Z"),
  };
  const rows: EvidenceSourceRows = {
    ...empty(),
    evidence: [
      { id: "se_c", sourceType: "ACTIVITY_EVALUATION", sourceId: "ev_1", sourceLabel: "x", skillId: "sk_spark", skillName: "Spark" },
      { id: "se_d", sourceType: "ACTIVITY_EVALUATION", sourceId: "ev_2", sourceLabel: "x", skillId: "sk_spark", skillName: "Spark" },
    ],
    evaluations: [
      {
        ...base,
        attempt: {
          submittedAt: D("2026-08-02T15:00:00Z"),
          enrollment: { userId: ME, cohort: { slug: "databricks-aug-2026", name: "August 2026" } },
          activity: { title: "Delta tables", dayNumber: 4, programTitle: "31 Days of Databricks" },
        },
      },
      {
        ...base,
        id: "ev_2",
        attempt: {
          submittedAt: null,
          enrollment: { userId: ME, cohort: { slug: "legacy-claude", name: "legacy" } },
          activity: { title: "Prompt chains", dayNumber: 12, programTitle: "60-Day Claude Challenge" },
        },
      },
    ],
  };
  const [cohort, challenge] = buildEvidenceProvenance(ME, rows).skills[0]!.items.map(tracedOrThrow);
  assert(cohort!.kind === "COHORT_ACTIVITY", cohort!.kind);
  assert(cohort!.name === "31 Days of Databricks · Day 4: Delta tables", cohort!.name);
  assert(cohort!.dateBasis === "Submitted", cohort!.dateBasis);
  assert(cohort!.detail === "August 2026 · Score 9/10 · Passed", String(cohort!.detail));
  assert(challenge!.kind === "CHALLENGE_DAY", challenge!.kind);
  assert(challenge!.dateBasis === "Evaluated", "no submittedAt → the evaluation date, labelled as such");
});

/* ── nothing fabricated: every failure is untraced, with a reason ────────── */

suite("a pointer to a row that no longer exists is untraced", () => {
  const rows = screenshotCandidate();
  rows.participants = [];
  const a = untracedOrThrow(buildEvidenceProvenance(ME, rows).achievements[2]!);
  assert(a.reason.includes("HackathonParticipant"), a.reason);
  assert(a.record.includes("hp_1"), "still says where it pointed");
});

suite("a pointer into another account's row is untraced", () => {
  const rows = screenshotCandidate();
  rows.participants = rows.participants.map((p) => ({ ...p, userId: OTHER }));
  const a = untracedOrThrow(buildEvidenceProvenance(ME, rows).achievements[2]!);
  assert(a.reason.includes("different account"), a.reason);
});

suite("a team the candidate is not on is untraced", () => {
  const rows = screenshotCandidate();
  rows.teams = rows.teams.map((t) => ({ ...t, candidateJoinedAt: null }));
  const c = untracedOrThrow(buildEvidenceProvenance(ME, rows).credentials[0]!.item);
  assert(c.reason.includes("not a participant"), c.reason);
});

suite("superseded and failed evaluations do not count as evidence", () => {
  const mk = (id: string, passed: boolean, isAuthoritative: boolean) => ({
    id,
    passed,
    isAuthoritative,
    score: 2,
    maxScore: 10,
    createdAt: D("2026-08-03T00:00:00Z"),
    attempt: {
      submittedAt: D("2026-08-02T00:00:00Z"),
      enrollment: { userId: ME, cohort: { slug: "c", name: "C" } },
      activity: { title: "T", dayNumber: 1, programTitle: "P" },
    },
  });
  const rows: EvidenceSourceRows = {
    ...empty(),
    evidence: [
      { id: "s1", sourceType: "ACTIVITY_EVALUATION", sourceId: "old", sourceLabel: "x", skillId: "k", skillName: "K" },
      { id: "s2", sourceType: "ACTIVITY_EVALUATION", sourceId: "fail", sourceLabel: "x", skillId: "k", skillName: "K" },
    ],
    evaluations: [mk("old", true, false), mk("fail", false, true)],
  };
  const skill = buildEvidenceProvenance(ME, rows).skills[0]!;
  assert(tracedCount(skill.items) === 0, "neither counts");
  assert(untracedOrThrow(skill.items[0]!).reason.includes("superseded"), "superseded named");
  assert(untracedOrThrow(skill.items[1]!).reason.includes("not a pass"), "fail named");
});

suite("a revoked credential behind an achievement is untraced", () => {
  const rows: EvidenceSourceRows = {
    ...empty(),
    achievements: [{ id: "a", sourceType: "CREDENTIAL", sourceId: "cred_gone", title: "HACKATHON", outcomeLabel: null }],
    linkedCredentials: [{ id: "cred_gone", credentialId: "ABT-HK-99999", userId: ME, status: "REVOKED" }],
  };
  const a = untracedOrThrow(only(buildEvidenceProvenance(ME, rows).achievements));
  assert(a.reason.includes("revoked"), a.reason);
});

suite("manual credentials and external evidence have nothing to trace", () => {
  const rows: EvidenceSourceRows = {
    ...empty(),
    evidence: [{ id: "e", sourceType: "EXTERNAL", sourceId: "x", sourceLabel: "LinkedIn cert", skillId: "k", skillName: "K" }],
    credentials: [
      { id: "c", credentialId: "ABT-XX-11111", type: "COMPLETION", sourceType: "MANUAL", sourceKey: "m", title: "Manual", metadata: null, issuedAt: D("2026-08-01T00:00:00Z") },
    ],
    achievements: [{ id: "a", sourceType: "EXTERNAL", sourceId: "x", title: "Award", outcomeLabel: null }],
  };
  const p = buildEvidenceProvenance(ME, rows);
  assert(tracedCount(allItems(p)) === 0, "none traced");
  assert(untracedOrThrow(p.credentials[0]!.item).reason.includes("manually"), "manual named");
});

suite("an enrolment with no completion date is only dated when a credential was issued for it", () => {
  const enrolment = {
    id: "pe_1",
    userId: ME,
    status: "COMPLETED",
    completedAt: null,
    cohort: { slug: "ai-cohort", name: "July 2026", programTitle: "AI Cohort Program" },
  };
  const rows: EvidenceSourceRows = {
    ...empty(),
    credentials: [
      { id: "c", credentialId: "ABT-CH-22222", type: "COMPLETION", sourceType: "PROGRAM_ENROLLMENT", sourceKey: "pe_1", title: "COHORT", metadata: null, issuedAt: D("2026-08-20T00:00:00Z") },
    ],
    achievements: [{ id: "a", sourceType: "PROGRAM_ENROLLMENT", sourceId: "pe_1", title: "AI Cohort Program", outcomeLabel: "Completed" }],
    enrollments: [enrolment],
  };
  const p = buildEvidenceProvenance(ME, rows);
  const cred = tracedOrThrow(p.credentials[0]!.item);
  assert(cred.dateBasis === "Credential issued", "the date is the issue date, and says so");
  assert(cred.detail?.includes("no completion date") === true, String(cred.detail));
  const ach = untracedOrThrow(only(p.achievements));
  assert(ach.reason.includes("no completion date"), "no date is invented for the achievement");
});

suite("programme-verified skills need a dated origin", () => {
  const rows: EvidenceSourceRows = {
    ...empty(),
    programmeSkills: [
      {
        skillId: "sk",
        name: "Prompt engineering",
        origins: [
          { kind: "CHALLENGE", programTitle: "60-Day Claude Challenge", enrollmentId: "enr_1", earnedAt: D("2026-07-25T10:00:00Z") },
          { kind: "COHORT", programTitle: "AI Cohort Program", enrollmentId: "pe_9", earnedAt: null },
        ],
      },
    ],
  };
  const [dated, undated] = buildEvidenceProvenance(ME, rows).programmeSkills[0]!.items;
  const s = tracedOrThrow(dated!);
  assert(s.dateBasis === "50th day submitted" && s.record === "Enrollment · enr_1", s.record);
  assert(untracedOrThrow(undated!).reason.includes("no completion date"), "undated origin is untraced");
});

suite("source ids are collected per table from the badge rows", () => {
  const ids = collectSourceIds(screenshotCandidate());
  assert(ids.team.has("team_1"), "team from the credential key");
  assert(ids.certificate.has("cert_a") && ids.certificate.has("cert_b"), "certificates from the key");
  assert(ids.credential.has("cred_cert_a"), "credential from the achievement");
  assert(ids.participant.has("hp_1"), "participant from the achievement");
});

/* ── the page and the loaders ─────────────────────────────────────────────── */

suite("the admin card only calls a skill evidence-backed with a traced source", () => {
  const card = code("src/components/admin/candidate-career-sections.tsx");
  assert(card.includes("tracedCount("), "badge counts traced sources");
  assert(
    !/skill\.verified|skill\.evidenceCount/.test(card),
    "the cached verified / evidenceCount flags no longer decide the badge",
  );
  assert(card.includes("Not traced"), "untraced rows are labelled");
  assert(card.includes("source.earnedAt"), "traced rows show the source date");
  assert(!card.includes('"use client"'), "still a Server Component");
});

suite("the loader reads sources by id so foreign pointers are caught", () => {
  const loader = code("src/features/admin/get-evidence-provenance.ts");
  assert(loader.includes("buildEvidenceProvenance("), "decisions live in the pure builder");
  assert(loader.includes("collectSourceIds("), "one pointer map");
  const assembler = code("src/features/admin/get-admin-candidate-detail.ts");
  assert(assembler.includes("getEvidenceProvenance(userId)"), "the admin page loads provenance");
});

suite("the 50th-day date reads the same rows the day count does", () => {
  const verified = code("src/features/profile/get-verified-skills.ts");
  const progress = code("src/repositories/progress.ts");
  for (const clause of ['id: { startsWith: "aa_sub_" }', 'activityId: { startsWith: "act_dt_" }', "isNewProgressRepoEnabled()"]) {
    assert(progress.includes(clause), `progress.ts no longer has ${clause}`);
    assert(verified.includes(clause), `get-verified-skills.ts does not mirror ${clause}`);
  }
  assert(
    verified.includes("export async function getVerifiedSkills(") &&
      verified.includes("({ skillId, name, sources })"),
    "the candidate-facing shape is unchanged",
  );
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
