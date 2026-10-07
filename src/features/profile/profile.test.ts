/**
 * Detailed candidate profile — Slice 1.
 *
 * Pure-function checks plus source assertions on the invariants that are
 * expensive to get wrong: skill claims must never destroy evidence, legacy
 * mirrors must never overwrite canonical data, and completeness must stay a UX
 * number with no authority over anything.
 *
 * Run: npm run test:profile
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CandidateGender,
  CandidateLinkType,
  CandidatePersona,
  GradeType,
  OpportunityType,
} from "@prisma/client";
import {
  educationSectionSchema,
  educationTimelineIssues,
  gradeScoreIssue,
  normalizeGithubUsername,
} from "@/lib/validations/candidate-profile";
import {
  pickPrimaryEducation,
  pickPrimaryExperience,
  toMonthDate,
  totalExperienceMonths,
} from "@/repositories/candidate-primary";
import { computeCompleteness } from "@/features/profile/completeness";
import { buildProfileReview } from "@/features/profile/build-review";
import {
  CITY_NAMES,
  STATE_NAMES,
  canonicalCityName,
  searchCities,
  searchStates,
  stateForCity,
} from "@/lib/city-catalog";
import {
  COLLEGE_DEGREES,
  DEGREES,
  FIELDS_OF_STUDY,
  OTHER_EDUCATION_DEGREES,
  assignEducationSlots,
  canonicalDegree,
  departmentsForDegree,
  educationLevelOf,
  inferGradeType,
} from "@/lib/candidate-vocab";
import {
  endBeforeStart,
  isFuture,
} from "@/components/profile/field-issues";
import {
  CANONICAL_SKILLS,
  CANONICAL_SKILL_NAMES,
  SKILL_GROUPS,
  canonicalSkillName,
  searchCanonicalSkills,
} from "@/lib/skill-catalog";
import type { CandidateDetail } from "@/repositories/candidate-detail";

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

const root = process.cwd();
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * Source with comments stripped. Assertions about what the code does must not
 * pass or fail on prose — a doc comment explaining that a value is never read
 * would otherwise read as that value being used.
 */
function code(rel: string): string {
  const raw = source(rel);
  return rel.endsWith(".sql")
    ? raw.replace(/--.*$/gm, "")
    : raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/* ─── GitHub normalization ───────────────────────────────────────────────── */

suite("GitHub URL and handle both normalize to the handle", () => {
  assert(normalizeGithubUsername("https://github.com/foo") === "foo", "https url");
  assert(normalizeGithubUsername("foo") === "foo", "bare handle");
  assert(normalizeGithubUsername("github.com/foo") === "foo", "no protocol");
  assert(
    normalizeGithubUsername("https://www.github.com/foo/") === "foo",
    "www + trailing slash",
  );
  assert(
    normalizeGithubUsername("https://github.com/foo?tab=repositories") === "foo",
    "query string dropped",
  );
  assert(
    normalizeGithubUsername("https://github.com/Sarthakgupta7") ===
      "Sarthakgupta7",
    "mixed case preserved",
  );
  assert(normalizeGithubUsername("@foo") === "foo", "at-prefixed");
  assert(normalizeGithubUsername("  foo  ") === "foo", "whitespace");
});

suite("GitHub normalization rejects what is not a handle", () => {
  assert(normalizeGithubUsername("") === null, "empty");
  assert(normalizeGithubUsername("   ") === null, "blank");
  assert(normalizeGithubUsername("https://github.com/") === null, "no segment");
  assert(normalizeGithubUsername("foo bar") === null, "space");
  assert(normalizeGithubUsername("-foo") === null, "leading hyphen");
  assert(normalizeGithubUsername("foo-") === null, "trailing hyphen");
  assert(normalizeGithubUsername("a".repeat(40)) === null, "too long");
});

/* ─── Primary education precedence ───────────────────────────────────────── */

const edu = (
  over: Partial<Parameters<typeof pickPrimaryEducation>[0][number]> & {
    name: string;
  },
) => ({
  degree: null,
  isCurrent: false,
  startYear: null,
  startMonth: null,
  graduationYear: null,
  endMonth: null,
  sortOrder: 0,
  ...over,
});

suite("primary education: Class X and XII never stand in for college", () => {
  const rows = [
    edu({ name: "xii", degree: "Higher Secondary (12th)", graduationYear: 2023 }),
    edu({ name: "x", degree: "SSC", graduationYear: 2021 }),
    edu({ name: "college", degree: "B.Tech", startYear: 2023 }),
  ];
  // The college row is undated and not marked current — it used to lose to
  // the dated Class XII row on "most recent end date".
  assert(pickPrimaryEducation(rows)?.name === "college", "college over a dated XII");
  assert(
    pickPrimaryEducation([edu({ name: "xii", degree: "Higher Secondary (12th)", isCurrent: true })]) === null,
    "school years alone give no primary education",
  );
  assert(
    pickPrimaryEducation([edu({ name: "dip", degree: "Diploma", graduationYear: 2022 })])?.name === "dip",
    "a diploma is a real qualification and still counts",
  );
});

suite("recruiter surfaces read education through the school-year filter", () => {
  const talent = code("src/repositories/talent.ts");
  assert(talent.includes("export function recruiterEducationWhere"), "one filter, defined once");
  assert(
    talent.includes("{ degree: null }") && talent.includes("notIn: [...SCHOOL_YEAR_DEGREES]"),
    "NULL degrees survive the notIn",
  );
  assert(
    (talent.match(/recruiterEducationWhere\(\)/g) ?? []).length >= 3,
    "identity overlay, search rows and the graduation-year filter all use it",
  );
  assert(
    code("src/repositories/program-state.ts").includes("where: recruiterEducationWhere()"),
    "AI cohort member rows use it too",
  );
});

suite("primary education: currently studying wins", () => {
  const rows = [
    edu({ name: "school", graduationYear: 2021, sortOrder: 0 }),
    edu({ name: "college", isCurrent: true, startYear: 2022, sortOrder: 1 }),
  ];
  assert(pickPrimaryEducation(rows)?.name === "college", "current row");
});

suite("primary education: latest start wins among several current rows", () => {
  const rows = [
    edu({ name: "older", isCurrent: true, startYear: 2022, startMonth: 8 }),
    edu({ name: "newer", isCurrent: true, startYear: 2024, startMonth: 1 }),
  ];
  assert(pickPrimaryEducation(rows)?.name === "newer", "latest start");
});

suite("primary education: falls back to the most recent end date", () => {
  const rows = [
    edu({ name: "school", graduationYear: 2019, endMonth: 5 }),
    edu({ name: "degree", graduationYear: 2023, endMonth: 6 }),
    edu({ name: "masters", graduationYear: 2023, endMonth: 12 }),
  ];
  assert(pickPrimaryEducation(rows)?.name === "masters", "latest end month");
});

suite("primary education: undated rows fall back to sortOrder", () => {
  const rows = [
    edu({ name: "second", sortOrder: 1 }),
    edu({ name: "first", sortOrder: 0 }),
  ];
  assert(pickPrimaryEducation(rows)?.name === "first", "lowest sortOrder");
  assert(pickPrimaryEducation([]) === null, "empty list");
});

/* ─── Primary experience precedence ──────────────────────────────────────── */

const exp = (
  over: Partial<Parameters<typeof pickPrimaryExperience>[0][number]> & {
    name: string;
  },
) => ({
  isCurrent: false,
  startMonth: 1,
  startYear: 2020,
  endMonth: null,
  endYear: null,
  ...over,
});

suite("primary experience: currently working wins", () => {
  const rows = [
    exp({ name: "past", startYear: 2019, endYear: 2021, endMonth: 6 }),
    exp({ name: "current", isCurrent: true, startYear: 2021, startMonth: 7 }),
  ];
  assert(pickPrimaryExperience(rows)?.name === "current", "current row");
});

suite("primary experience: otherwise the most recently ended", () => {
  const rows = [
    exp({ name: "intern-1", startYear: 2022, endYear: 2022, endMonth: 6 }),
    exp({ name: "intern-2", startYear: 2023, endYear: 2023, endMonth: 8 }),
  ];
  assert(pickPrimaryExperience(rows)?.name === "intern-2", "latest end");
  assert(pickPrimaryExperience([]) === null, "empty list");
});

/* ─── Merged experience duration ─────────────────────────────────────────── */

const NOW = new Date(Date.UTC(2026, 7, 31)); // 2026-08

suite("experience months are inclusive of both endpoints", () => {
  const one = totalExperienceMonths(
    [exp({ name: "x", startYear: 2024, startMonth: 1, endYear: 2024, endMonth: 1 })],
    NOW,
  );
  assert(one === 1, `single month should be 1, got ${one}`);

  const year = totalExperienceMonths(
    [exp({ name: "x", startYear: 2024, startMonth: 1, endYear: 2024, endMonth: 12 })],
    NOW,
  );
  assert(year === 12, `full year should be 12, got ${year}`);
});

suite("overlapping roles are not double counted", () => {
  const rows = [
    exp({ name: "a", startYear: 2024, startMonth: 1, endYear: 2024, endMonth: 12 }),
    exp({ name: "b", startYear: 2024, startMonth: 6, endYear: 2025, endMonth: 6 }),
  ];
  // Jan 2024 → Jun 2025 inclusive is 18 months; a naive sum would say 25.
  const merged = totalExperienceMonths(rows, NOW);
  assert(merged === 18, `expected 18, got ${merged}`);
});

suite("disjoint roles are summed, current roles run to today", () => {
  const gap = totalExperienceMonths(
    [
      exp({ name: "a", startYear: 2020, startMonth: 1, endYear: 2020, endMonth: 6 }),
      exp({ name: "b", startYear: 2023, startMonth: 1, endYear: 2023, endMonth: 6 }),
    ],
    NOW,
  );
  assert(gap === 12, `expected 12, got ${gap}`);

  const current = totalExperienceMonths(
    [exp({ name: "a", isCurrent: true, startYear: 2026, startMonth: 1 })],
    NOW,
  );
  assert(current === 8, `Jan→Aug 2026 should be 8, got ${current}`);
  assert(totalExperienceMonths([], NOW) === 0, "no rows");
});

suite("month packing lands on the first of the month, UTC", () => {
  const d = toMonthDate(2024, 3);
  assert(d.getUTCFullYear() === 2024, "year");
  assert(d.getUTCMonth() === 2, "zero-based month");
  assert(d.getUTCDate() === 1, "first of month");
});

/* ─── Skill ownership: the deletion bug must stay fixed ──────────────────── */

suite("legacy skill sync lives on CandidateSkill, not dual-write.ts", () => {
  assert(
    !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
    "dual-write.ts deleted",
  );
  const src = source("src/repositories/candidate.ts");
  assert(src.includes("candidateSkill"), "canonical skill table");
});

suite("legacy skill sync does not overwrite the candidate's own rating", () => {
  assert(
    !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
    "dual-write.ts deleted",
  );
});

suite("removing a skill withdraws the claim but keeps the evidence", () => {
  const src = source("src/repositories/candidate-detail.ts");
  const fn = src.slice(src.indexOf("export async function saveSkillClaims"));
  assert(fn.includes("claimedByCandidate: false"), "claim withdrawn");
  assert(
    fn.includes("evidenceCount > 0 || row._count.evidence > 0"),
    "evidence-bearing rows are detected",
  );
  assert(fn.includes("keepIds"), "evidence-bearing rows are kept, not deleted");
  // SkillEvidence cascades off CandidateSkill: deleting the row destroys history.
  assert(
    fn.indexOf("keepIds.push") < fn.indexOf("dropIds.push"),
    "keeping is the first branch",
  );
});

suite("a deactivated catalog skill is left alone, not silently withdrawn", () => {
  const src = code("src/repositories/candidate-detail.ts");
  const fn = src.slice(src.indexOf("export async function saveSkillClaims"));
  // Withdrawal must key on what was submitted; keying on catalog validity would
  // un-claim a skill the candidate resubmits every time.
  assert(
    fn.includes("existing.filter((row) => !wanted.has(row.skillId))"),
    "withdrawal keys on the submitted set",
  );
  assert(
    !fn.includes("existing.filter((row) => !validIds.has(row.skillId))"),
    "not on catalog validity",
  );
});

suite("only the detailed profile may remove skill claims", () => {
  const detail = source("src/repositories/candidate-detail.ts");
  const deletesInDetail = detail.split("candidateSkill.deleteMany").length - 1;
  assert(deletesInDetail === 1, "exactly one deletion site");
  assert(
    !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
    "legacy dual-write path is gone",
  );
});

/* ─── Multi-row education / experience ───────────────────────────────────── */

suite("the identity view no longer filters to the migration singletons", () => {
  const src = source("src/repositories/candidate.ts");
  assert(
    !src.includes('startsWith: "edu_sp_"'),
    "education id filter removed",
  );
  assert(
    !src.includes('startsWith: "exp_sp_"'),
    "experience id filter removed",
  );
  assert(src.includes("pickPrimaryEducation"), "uses the precedence rule");
  assert(src.includes("pickPrimaryExperience"), "uses the precedence rule");
});

suite("the detailed read returns whole arrays, not one row", () => {
  const src = source("src/repositories/candidate-detail.ts");
  const start = src.indexOf("export async function getCandidateDetail");
  const end = src.indexOf("export async function listSelfReportedExternalLinks");
  const fn = src.slice(start, end === -1 ? undefined : end);
  for (const rel of ["education", "experience", "projects", "certifications", "links"]) {
    assert(fn.includes(`${rel}: {`), `${rel} selected`);
  }
  assert(!fn.includes("edu_sp_"), "no singleton filter");
  assert(!fn.includes("take: 1"), "no implicit single row");
});

suite("saving a section replaces the list, clearing the migration rows", () => {
  const src = source("src/repositories/candidate-detail.ts");
  for (const model of [
    "candidateEducation",
    "candidateExperience",
    "candidateProjectEntry",
    "candidateCertification",
    "candidateLink",
  ]) {
    assert(
      src.includes(`tx.${model}.deleteMany({ where: { userId } })`),
      `${model} replaced wholesale`,
    );
  }
});

suite("a legacy form cannot overwrite candidate-authored history", () => {
  assert(
    !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
    "dual-write.ts deleted",
  );
  const src = source("src/repositories/candidate-detail.ts");
  assert(src.includes("candidateEducation"), "education is canonical");
  assert(src.includes("candidateExperience"), "experience is canonical");
});

/* ─── Legacy mirroring direction ─────────────────────────────────────────── */

suite("legacy StudentProfile mirrors are retired", () => {
  const src = source("src/repositories/candidate-detail.ts");
  assert(!src.includes("mirrorEducationToLegacy"), "education mirror gone");
  assert(!src.includes("mirrorExperienceToLegacy"), "experience mirror gone");
  assert(!src.includes("mirrorSkillsToLegacy"), "skills mirror gone");
  assert(!src.includes("studentProfile"), "no StudentProfile delegate");
});

suite("emptying a section no longer remirrors StudentProfile", () => {
  const src = source("src/repositories/candidate-detail.ts");
  assert(!src.includes("studentProfile.updateMany"), "no SP remirror");
});

suite("basic info writes only its own fields and never domain", () => {
  const src = source("src/repositories/candidate-detail.ts");
  const fn = src.slice(
    src.indexOf("export async function saveBasicInfo"),
    src.indexOf("export type EducationWrite"),
  );
  assert(!fn.includes("domain"), "domain is never copied into CandidateProfile");
  assert(!fn.includes("linkedinUrl"), "does not touch links");
  assert(!fn.includes("resumeUrl"), "does not touch resume");
  assert(!fn.includes("referralCode"), "does not re-mint referral code");
  assert(!fn.includes("phoneVerified"), "verification stays with the OTP flow");
});

suite("no section save clears richer canonical values it did not receive", () => {
  const src = source("src/repositories/candidate-detail.ts");
  // Each write names its own columns explicitly; nothing spreads a whole
  // StudentProfile row over CandidateProfile.
  assert(
    !src.includes("...sp,"),
    "no wholesale legacy spread into CandidateProfile",
  );
  assert(!src.includes("data: sp"), "no wholesale legacy assignment");
});

suite("referral code is never minted or rewritten by the profile editor", () => {
  const raw = source("src/repositories/candidate-detail.ts");
  // Reading the code to display a referral link is fine. What must never
  // happen is a write: no save path may set, rotate, or mint one.
  assert(raw.includes("referralCode: true"), "read as a select");
  const writes = raw
    .slice(raw.indexOf("export type BasicInfoWrite"))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert(writes.length > 0, "write half located");
  assert(!writes.includes("referralCode"), "no save path touches the code");
  assert(!raw.includes("mintHireOnlyReferralCode"), "no second minting path");
  assert(raw.includes("ensureCandidateProfile"), "reuses the existing helper");
});

/* ─── Preferences vs visibility ──────────────────────────────────────────── */

suite("preferences never touch CandidateVisibility", () => {
  const src = source("src/repositories/candidate-detail.ts");
  assert(
    !src.includes("candidateVisibility"),
    "the profile editor cannot change recruiter discoverability",
  );
  // The one exception is not a choice: once a name and a claimed skill exist,
  // the platform creates its default discovery record if none exists
  // (repositories/discovery-record.ts, pinned in the visibility suite). The
  // preferences save must not trigger it.
  const prefs = src.slice(
    src.indexOf("export async function savePreferences"),
    src.indexOf("export async function saveSkillClaims"),
  );
  assert(prefs.length > 0, "savePreferences located");
  assert(
    !prefs.includes("ensureDiscoveryRecord"),
    "saving preferences never creates a discovery record",
  );
  assert(src.includes("candidatePreference.upsert"), "preferences still saved");
});

suite("verified accomplishments are derived, never stored", () => {
  const src = source("src/features/profile/get-verified-accomplishments.ts");
  // The whole point of the section: the platform attests, the user cannot edit.
  for (const write of ["create", "update", "upsert", "delete", "createMany"]) {
    assert(!src.includes(`.${write}(`), `derivation never writes (.${write})`);
  }
  // Opening the profile must not issue a certificate as a side effect —
  // that is /achievements' job, and it is a write.
  assert(
    !src.includes("ensureClaudeCertificate") &&
      !src.includes("ensureHackathonCertificate"),
    "reading the profile never issues a certificate",
  );
  // Credentials go through the flag-aware repository, not a raw table read.
  assert(src.includes("listForUser"), "credentials read via the repository");
  assert(
    !src.includes("prisma.certificate.") && !src.includes("prisma.credential."),
    "no direct certificate/credential table read",
  );
  // Each rule reads the source of truth the rest of the platform already writes.
  assert(src.includes("CHALLENGE_ELIGIBLE_DAYS = 50"), "50-day gate is explicit");
  assert(src.includes("listChallengePeRows") || src.includes("programEnrollment"), "challenge days from ProgramEnrollment");
  assert(
    src.includes("prisma.programEnrollment.findMany"),
    "cohort completion from ProgramEnrollment",
  );
  assert(
    src.includes("prisma.hackathonParticipant.findFirst"),
    "hackathon from HackathonParticipant",
  );
  assert(src.includes("CertificateStatus.REVOKED"), "revoked credentials excluded");
});

suite("the accomplishments write path cannot forge a verified row", () => {
  const schema = source("src/lib/validations/candidate-profile.ts");
  const idx = schema.indexOf("export const accomplishmentsSchema");
  assert(idx !== -1, "accomplishments schema exists");
  const block = schema.slice(idx, idx + 400);
  // Only the two candidate-authored parts are accepted at the boundary.
  assert(block.includes("rows:") && block.includes("awards:"), "rows + awards only");
  assert(!block.includes("verified"), "no verified field crosses the boundary");

  const repo = source("src/repositories/candidate-detail.ts");
  assert(
    repo.includes("export async function saveAccomplishments"),
    "one writer for the section",
  );
  // Awards live on the profile row, NOT on the platform-evidence table.
  assert(
    !repo.includes("candidateAchievement"),
    "awards never written to CandidateAchievement",
  );
});

suite("self-rating is gone from the whole skills path", () => {
  const ui = code("src/components/profile/skills-section.tsx");
  const schema = code("src/lib/validations/candidate-profile.ts");
  const repo = code("src/repositories/candidate-detail.ts");
  const vocab = code("src/lib/candidate-vocab.ts");
  for (const [label, src] of [
    ["the section UI", ui],
    ["the boundary schema", schema],
    ["the write path", repo],
    ["the vocabulary", vocab],
  ] as const) {
    assert(!src.includes("selfRated"), `no selfRated in ${label}`);
    assert(!src.includes("SkillProficiency"), `no SkillProficiency in ${label}`);
  }
  assert(!vocab.includes("PROFICIENCY_LABELS"), "rating labels removed");
  // The removed copy must not creep back in.
  assert(
    !ui.includes("Pick from the catalog") && !ui.includes("Self-rating"),
    "removed helper copy stays removed",
  );
});

suite("verified skills are derived from curriculum and completion", () => {
  const src = code("src/features/profile/get-verified-skills.ts");
  // Derived, never stored: no write of any kind, so the user cannot edit them.
  for (const write of ["create", "update", "upsert", "delete", "createMany"]) {
    assert(!src.includes(`.${write}(`), `derivation never writes (.${write})`);
  }
  // Curriculum → skills comes from the EXISTING join table, not a new one.
  assert(src.includes("skills:"), "reads ProgramSkill through the program");
  assert(
    src.includes("learningProgram.findMany"),
    "challenge skills hang off the challenge's LearningProgram",
  );
  // Enrolment alone must never be enough.
  assert(src.includes("CHALLENGE_ELIGIBLE_DAYS = 50"), "50-day bar is explicit");
  assert(
    src.includes("daysCompleted >= CHALLENGE_ELIGIBLE_DAYS"),
    "challenge bar is days completed, not enrolment",
  );
  assert(
    src.includes("EnrollmentStatusV2.COMPLETED"),
    "cohort bar is a completed run",
  );
  // A challenge is mirrored into ProgramEnrollment as a legacy-<domain> cohort;
  // counting that too would let it in under the cohort bar instead of the 50-day one.
  assert(
    src.includes("CHALLENGE_MIRROR_COHORT_SLUGS"),
    "challenge mirror cohorts excluded from the cohort rule",
  );
});

suite("the same mirror exclusion guards verified accomplishments", () => {
  const src = code("src/features/profile/get-verified-accomplishments.ts");
  assert(
    src.includes("CHALLENGE_MIRROR_COHORT_SLUGS"),
    "a finished challenge is not also listed as a cohort",
  );
});

suite("wins-only accomplishments use 50-day Claude and placement-only hackathon", () => {
  const src = code("src/features/profile/get-verified-accomplishments.ts");
  assert(
    src.includes('mode: VerifiedAccomplishmentMode = "profile"'),
    "profile remains the default so /profile is unchanged",
  );
  assert(src.includes('"wins-only"'), "recruiter path is an explicit mode");
  assert(
    src.includes("Domain.CLAUDE"),
    "Claude enrollments are in the 50-day path",
  );
  assert(
    src.includes("if (!winsOnly && claude)"),
    "profile still gates Claude on the certificate",
  );
  assert(
    src.includes("winsOnly") && src.includes("best !== null"),
    "wins-only hackathon requires a placement",
  );
  assert(
    src.includes("const days = stats.daysCompleted;"),
    "50-day gate uses canonical AA days, not frozen Enrollment.daysCompleted",
  );
  const profilePage = code("src/app/profile/page.tsx");
  assert(
    profilePage.includes("getVerifiedAccomplishments(userId)"),
    "/profile still calls the default profile mode",
  );
  assert(
    !profilePage.includes('"wins-only"'),
    "/profile must not switch to recruiter wins-only",
  );
});

suite("curriculum skills are data, not a hardcoded frontend list", () => {
  const content = JSON.parse(
    source("prisma/content/curriculum-skills.json"),
  ) as { programs: { program: string; skills: { name: string }[] }[] };
  const slugs = content.programs.map((p) => p.program);
  // Every track the platform runs is covered.
  for (const slug of [
    "claude-challenge",
    "software-engineering-challenge",
    "data-science-challenge",
    "ai-engineering-challenge",
    "ai-cohort-program",
    "databricks",
    "powerbi",
    "ds-architect",
    "snowflake",
  ]) {
    assert(slugs.includes(slug), `${slug} has curriculum skills`);
  }
  assert(new Set(slugs).size === slugs.length, "no duplicate program entries");
  for (const entry of content.programs) {
    assert(entry.skills.length > 0, `${entry.program} lists skills`);
    const names = entry.skills.map((s) => s.name);
    assert(
      new Set(names).size === names.length,
      `${entry.program} has no duplicate skills`,
    );
    // "Only meaningful core skills, not every minor topic."
    assert(entry.skills.length <= 12, `${entry.program} stays a core list`);
  }
  // The UI must not carry its own copy of any of this.
  const ui = code("src/components/profile/skills-section.tsx");
  for (const name of ["PySpark", "Delta Lake", "Kubernetes", "LangChain"]) {
    assert(!ui.includes(name), `${name} is not hardcoded in the UI`);
  }
});

suite("evidence is read from real rows only", () => {
  const src = code("src/features/profile/get-evidence.ts");
  assert(src.includes("evidence: { some: {} }"), "verified means it has evidence");
  assert(src.includes("candidateAchievement"), "achievements are read");
  assert(src.includes("CredentialStatus.ISSUED"), "revoked credentials excluded");
  assert(!src.includes("selfRated"), "self-rating is never selected as evidence");
});

/* ─── Plan 133: no candidate-controlled visibility on profile surfaces ─── */

suite("the candidate's evidence read carries no recruiter-visibility state", () => {
  const src = code("src/features/profile/get-evidence.ts");
  // Visibility is a platform decision, so it is not the candidate's data to be
  // shown as though they could change it.
  assert(!src.includes("candidateVisibility"), "does not read CandidateVisibility");
  assert(!src.includes("recruiterVisibility"), "does not return recruiterVisibility");
  assert(!src.includes("searchableByRecruiters"), "does not return discoverability");
  assert(!/show[A-Z][a-zA-Z]+:/.test(src), "does not return a per-field show* flag");
});

suite("no profile surface renders discoverability or per-field visibility", () => {
  for (const rel of [
    "src/components/profile/evidence-section.tsx",
    "src/app/profile/page.tsx",
  ]) {
    const src = code(rel);
    assert(!src.includes("recruiterVisibility"), `${rel}: no visibility prop`);
    assert(!/discoverab/i.test(src), `${rel}: no discoverability copy`);
    assert(
      !/recruiter visibility/i.test(src),
      `${rel}: no "recruiter visibility" label`,
    );
    assert(
      !/shown["']?\s*:\s*["']?hidden|\?\s*"shown"\s*:\s*"hidden"/.test(src),
      `${rel}: no shown/hidden field toggle copy`,
    );
  }
});

suite("no profile write path touches recruiter visibility", () => {
  for (const rel of [
    "src/app/actions/candidate-profile-actions.ts",
    "src/repositories/candidate-detail.ts",
    "src/repositories/candidate.ts",
    "src/lib/validations/candidate-profile.ts",
  ]) {
    const src = code(rel);
    assert(
      !/candidateVisibility\.(create|update|upsert|updateMany|delete)/.test(src),
      `${rel} must not write CandidateVisibility`,
    );
    assert(
      !src.includes("recruiterVisibilityConsentAt"),
      `${rel} must not write the legacy consent column`,
    );
    for (const key of [
      "searchableByRecruiters",
      "isDiscoverable",
      "fieldVisibility",
      "visibleFields",
    ]) {
      assert(!src.includes(`${key}:`), `${rel} must not accept ${key}`);
    }
  }
});

/* ─── Completeness ───────────────────────────────────────────────────────── */

function detailFixture(over: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    userId: "u1",
    fullName: "Test User",
    headline: null,
    summary: null,
    awards: null,
    gender: null,
    primaryPersona: CandidatePersona.STUDENT,
    phone: null,
    phoneVerified: false,
    locationCity: null,
    locationRegion: null,
    countryCode: null,
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    resumeUrl: null,
    hasNoWorkExperience: false,
    referralCode: "ABC123",
    isReadyForInterview: false,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    skills: [],
    links: [],
    preference: null,
    ...over,
  };
}

function completeness(
  over: Partial<CandidateDetail> = {},
  extras: { hasResume?: boolean } = {},
) {
  return computeCompleteness(detailFixture(over), {
    hasResume: extras.hasResume ?? false,
  });
}

function sectionEarned(
  result: ReturnType<typeof computeCompleteness>,
  key: string,
): number {
  const s = result.sections.find((x) => x.key === key);
  assert(s !== undefined, `missing section ${key}`);
  return s!.weight * s!.fraction;
}

const skill = (id: string, claimed = true) => ({
  skillId: id,
  name: id,
  slug: id,
  categoryName: null,
  claimedByCandidate: claimed,
  verified: false,
  evidenceScore: 0,
  evidenceCount: 0,
  lastEvidenceAt: null,
});

const completeExperience = (
  over: Partial<CandidateDetail["experience"][number]> = {},
): CandidateDetail["experience"][number] => ({
  id: "x1",
  companyName: "Acme",
  title: "Intern",
  employmentType: "Internship",
  locationCity: "Pune",
  startMonth: 6,
  startYear: 2024,
  endMonth: 8,
  endYear: 2024,
  isCurrent: false,
  totalMonths: 3,
  description: null,
  ...over,
});

const completeEducation = (
  over: Partial<CandidateDetail["education"][number]> = {},
): CandidateDetail["education"][number] => ({
  id: "e1",
  institutionName: "IIT Bombay",
  collegeId: null,
  degree: "B.Tech",
  fieldOfStudy: "CSE",
  startMonth: 7,
  startYear: 2022,
  endMonth: 5,
  graduationYear: 2026,
  isCurrent: false,
  gradeType: GradeType.CGPA_10,
  grade: "8.6",
  description: "Core CS",
  ...over,
});

const completeTenth = (
  over: Partial<CandidateDetail["education"][number]> = {},
): CandidateDetail["education"][number] => ({
  id: "e10",
  institutionName: "Kendriya Vidyalaya",
  collegeId: null,
  degree: "Secondary (10th)",
  fieldOfStudy: null,
  startMonth: null,
  startYear: null,
  endMonth: null,
  graduationYear: 2018,
  isCurrent: false,
  gradeType: GradeType.PERCENTAGE,
  grade: "91",
  description: null,
  ...over,
});

const completeTwelfth = (
  over: Partial<CandidateDetail["education"][number]> = {},
): CandidateDetail["education"][number] => ({
  id: "e12",
  institutionName: "Kendriya Vidyalaya",
  collegeId: null,
  degree: "Higher Secondary (12th)",
  fieldOfStudy: "Science (PCM)",
  startMonth: null,
  startYear: null,
  endMonth: null,
  graduationYear: 2020,
  isCurrent: false,
  gradeType: GradeType.PERCENTAGE,
  grade: "88",
  description: null,
  ...over,
});

const completeProject = (
  over: Partial<CandidateDetail["projects"][number]> = {},
): CandidateDetail["projects"][number] => ({
  id: "p1",
  title: "ABTalks",
  description: "A talent platform",
  techStack: ["TypeScript"],
  repoUrl: "https://github.com/abtalks/app",
  liveUrl: "https://abtalks.in",
  ...over,
});

const completeCert = (
  over: Partial<CandidateDetail["certifications"][number]> = {},
): CandidateDetail["certifications"][number] => ({
  id: "c1",
  name: "AWS CCP",
  issuer: "Amazon",
  issuedMonth: 1,
  issuedYear: 2025,
  expiresMonth: null,
  expiresYear: null,
  credentialUrl: "https://aws.amazon.com/cert",
  ...over,
});

const emptyPref = {
  openToWork: false,
  preferredRoles: [] as string[],
  preferredLocations: [] as string[],
  opportunityTypes: [] as OpportunityType[],
  remotePreference: null,
  willingToRelocate: false,
  noticePeriodDays: null,
  availableFromMonth: null,
  availableFromYear: null,
  currentCtc: null,
  currentCtcCurrency: null,
  expectedCtc: null,
  expectedCtcCurrency: null,
};

function fullProfile(
  over: Partial<CandidateDetail> = {},
): Partial<CandidateDetail> {
  return {
    fullName: "Test User",
    phone: "+919876543210",
    primaryPersona: CandidatePersona.STUDENT,
    locationCity: "Pune",
    locationRegion: "Maharashtra",
    countryCode: "IN",
    gender: CandidateGender.MALE,
    headline: "CSE student",
    summary: "I build things",
    experience: [completeExperience({ description: "Shipped features" })],
    education: [completeEducation(), completeTwelfth(), completeTenth()],
    projects: [completeProject()],
    skills: [skill("a"), skill("b"), skill("c")],
    certifications: [completeCert()],
    awards: "Dean list",
    linkedinUrl: "https://linkedin.com/in/x",
    githubUsername: "tester",
    portfolioUrl: "https://tester.dev",
    preference: {
      ...emptyPref,
      preferredRoles: ["Engineer"],
      preferredLocations: ["Pune"],
    },
    ...over,
  };
}

suite("completeness is deterministic and bounded", () => {
  const blank = completeness({ fullName: "" });
  // Plans 174 + 176: empty accomplishments (5%) and empty preferences (3%) on
  // top of default persona (2%).
  assert(
    blank.score === 10,
    `empty name has persona 2% + optional accomp 5% + optional prefs 3%, got ${blank.score}`,
  );

  const again = completeness({ fullName: "" });
  assert(again.score === blank.score, "same input, same score");
  assert(blank.sections.length === 9, "every section reported");
  assert(blank.score <= 100, "never above 100");
});

suite("every basic field has its own weight", () => {
  // Empty certs + empty preferences contribute optional 5% + 3% on every fixture.
  const optionalExtras = 8;
  const personaOnly = completeness({ fullName: "" });
  assert(
    personaOnly.score === 2 + optionalExtras,
    `persona 2% (+ optional accomp/prefs), got ${personaOnly.score}`,
  );

  const nameAndPersona = completeness();
  assert(
    nameAndPersona.score === 6 + optionalExtras,
    `name 4 + persona 2 (+ optional accomp/prefs), got ${nameAndPersona.score}`,
  );

  const withHeadline = completeness({ headline: "Final-year CSE student" });
  assert(
    withHeadline.score === 11 + optionalExtras,
    `+headline 5, got ${withHeadline.score}`,
  );

  const withAbout = completeness({
    headline: "Final-year CSE student",
    summary: "About me",
  });
  assert(withAbout.score === 14 + optionalExtras, `+about 3, got ${withAbout.score}`);

  const withPhone = completeness({ phone: "+919876543210" });
  assert(withPhone.score === 9 + optionalExtras, `+phone 3, got ${withPhone.score}`);

  const badPhone = completeness({ phone: "   " });
  assert(badPhone.score === 6 + optionalExtras, "whitespace phone does not count");
  const invalidPhone = completeness({ phone: "abc" });
  assert(invalidPhone.score === 6 + optionalExtras, "invalid phone does not count");

  const withCity = completeness({ locationCity: "Pune" });
  assert(withCity.score === 8 + optionalExtras, `+city 2, got ${withCity.score}`);
  const withRegion = completeness({ locationRegion: "Maharashtra" });
  assert(withRegion.score === 8 + optionalExtras, `+state 2, got ${withRegion.score}`);
  const withCountry = completeness({ countryCode: "IN" });
  assert(withCountry.score === 8 + optionalExtras, `+country 2, got ${withCountry.score}`);
  const withGender = completeness({ gender: CandidateGender.FEMALE });
  assert(withGender.score === 8 + optionalExtras, `+gender 2, got ${withGender.score}`);
  const noGender = completeness({ gender: null });
  assert(noGender.score === 6 + optionalExtras, "null gender does not count");

  const basic = withHeadline.sections.find((x) => x.key === "basic");
  assert(basic !== undefined && !basic.complete, "partial basic not complete");
  assert(
    basic !== undefined && basic.fraction > 0 && basic.fraction < 1,
    "partial basic reports a fraction",
  );
});

suite("experience is gated on required fields of entry #1", () => {
  const missingRole = completeness({
    experience: [completeExperience({ title: "" })],
  });
  assert(sectionEarned(missingRole, "experience") === 0, "missing role gates to 0");

  const missingType = completeness({
    experience: [completeExperience({ employmentType: null })],
  });
  assert(sectionEarned(missingType, "experience") === 0, "missing type gates to 0");

  const missingLocation = completeness({
    experience: [completeExperience({ locationCity: "  " })],
  });
  assert(
    sectionEarned(missingLocation, "experience") === 0,
    "whitespace location gates to 0",
  );

  const missingEnd = completeness({
    experience: [completeExperience({ endYear: null, isCurrent: false })],
  });
  assert(sectionEarned(missingEnd, "experience") === 0, "missing end gates to 0");

  const requiredOnly = completeness({
    experience: [completeExperience()],
  });
  assert(
    sectionEarned(requiredOnly, "experience") === 16,
    `required experience is 16, got ${sectionEarned(requiredOnly, "experience")}`,
  );
  assert(
    requiredOnly.sections.find((x) => x.key === "experience")?.complete === true,
    "required-complete experience ticks even without description",
  );

  const withDesc = completeness({
    experience: [completeExperience({ description: "Shipped features" })],
  });
  assert(sectionEarned(withDesc, "experience") === 20, "description adds 4");

  const current = completeness({
    experience: [
      completeExperience({ isCurrent: true, endYear: null, endMonth: null }),
    ],
  });
  assert(
    sectionEarned(current, "experience") === 16,
    "currently working satisfies the end date",
  );
});

suite("additional experiences do not increase completion", () => {
  const one = completeness({
    experience: [completeExperience({ description: "One" })],
  });
  const two = completeness({
    experience: [
      completeExperience({ description: "One" }),
      completeExperience({
        id: "x2",
        companyName: "Other",
        title: "Lead",
        description: "Richer second row",
      }),
    ],
  });
  assert(one.score === two.score, "second experience adds nothing");
});

suite("deleting experience #1 rescores the new first row", () => {
  const afterDelete = completeness({
    experience: [
      completeExperience({
        id: "x2",
        companyName: "Other",
        title: "",
      }),
    ],
  });
  assert(
    sectionEarned(afterDelete, "experience") === 0,
    "the former #2 is now gated as #1",
  );
});

suite("education is three slots of 5% each, each gated on its own fields", () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const edu = (...rows: CandidateDetail["education"]) =>
    sectionEarned(completeness({ education: rows }), "education");

  // College.
  assert(near(edu(completeEducation()), 5), "a full college row is 5");
  assert(edu(completeEducation({ degree: null })) === 0, "missing degree gates college to 0");
  assert(edu(completeEducation({ fieldOfStudy: " " })) === 0, "missing field gates college to 0");
  assert(
    near(edu(completeEducation({ gradeType: null, grade: null, description: null })), 4),
    "required college fields alone are 4",
  );
  assert(
    near(
      edu(
        completeEducation({
          isCurrent: true,
          graduationYear: null,
          endMonth: null,
          gradeType: null,
          grade: null,
          description: null,
        }),
      ),
      4,
    ),
    "currently studying satisfies the college end date",
  );

  // Class X.
  assert(near(edu(completeTenth()), 5), "a full Class X row is 5");
  assert(near(edu(completeTenth({ grade: null })), 4), "Class X without a score is 4");
  assert(edu(completeTenth({ graduationYear: null })) === 0, "Class X needs its year");

  // Class XII or a Diploma — either fills the same slot.
  assert(near(edu(completeTwelfth()), 5), "a full Class XII row is 5");
  assert(
    near(edu(completeTwelfth({ degree: "Diploma", fieldOfStudy: "Civil Engineering" })), 5),
    "a diploma fills the XII slot",
  );
  assert(edu(completeTwelfth({ fieldOfStudy: null })) === 0, "Class XII needs its stream");
  assert(
    near(edu(completeTwelfth({ isCurrent: true, graduationYear: null })), 5),
    "still in Class XII satisfies the year",
  );

  // All three, in any order.
  const all = completeness({
    education: [completeTenth(), completeTwelfth(), completeEducation()],
  });
  assert(near(sectionEarned(all, "education"), 15), "all three slots are 15");
  assert(
    all.sections.find((x) => x.key === "education")?.complete === true,
    "and tick the section",
  );
  const collegeOnly = completeness({ education: [completeEducation()] });
  assert(
    collegeOnly.sections.find((x) => x.key === "education")?.complete === false,
    "college alone does not tick the section",
  );
  assert(
    miss(collegeOnly, "education").join(",") === "Class XII or Diploma details,Class X details",
    `the empty slots are named, got ${miss(collegeOnly, "education").join(",")}`,
  );

  // Extra rows never add.
  assert(
    near(
      edu(
        completeEducation(),
        completeEducation({ id: "e2", institutionName: "Other", degree: "M.Tech" }),
        completeTwelfth(),
        completeTenth(),
      ),
      15,
    ),
    "other education adds 0",
  );

  // Résumé spellings land in the right slots.
  assert(
    near(
      edu(
        completeTenth({ degree: "SSC" }),
        completeTwelfth({ degree: "CBSE Class XII" }),
        completeEducation({ degree: "B.Tech" }),
      ),
      15,
    ),
    "SSC, CBSE Class XII and B.Tech fill X, XII and College",
  );

  // A school with no degree is not a college.
  assert(
    edu(completeEducation({ institutionName: "Delhi Public School", degree: null })) === 0,
    "a bare school row does not fill the College slot",
  );
});

function miss(
  result: ReturnType<typeof computeCompleteness>,
  key: string,
): string[] {
  return result.sections.find((x) => x.key === key)?.missing ?? [];
}

suite("projects award fields independently on entry #1 only", () => {
  const empty = completeness();
  assert(sectionEarned(empty, "projects") === 0, "no projects is 0");

  const nameOnly = completeness({
    projects: [
      completeProject({
        description: null,
        techStack: [],
        repoUrl: null,
        liveUrl: null,
      }),
    ],
  });
  assert(sectionEarned(nameOnly, "projects") === 3, "name alone is 3");

  const three = completeness({
    projects: [
      completeProject({ repoUrl: null, liveUrl: null }),
    ],
  });
  assert(sectionEarned(three, "projects") === 11, "name+desc+stack is 11");

  const emptyStack = completeness({
    projects: [completeProject({ techStack: [], repoUrl: null, liveUrl: null })],
  });
  assert(
    sectionEarned(emptyStack, "projects") === 8,
    "empty tech stack does not count",
  );

  // The live demo is optional and weighs nothing either way.
  const withDemo = completeness({ projects: [completeProject()] });
  const withoutDemo = completeness({ projects: [completeProject({ liveUrl: null })] });
  assert(sectionEarned(withoutDemo, "projects") === 15, "no demo link is still 15");
  assert(withDemo.score === withoutDemo.score, "a demo link adds nothing");

  const one = completeness({ projects: [completeProject()] });
  const two = completeness({
    projects: [completeProject(), completeProject({ id: "p2", title: "Other" })],
  });
  assert(one.score === two.score, "second project adds nothing");
});

suite("skills use a 0 / 5 / 10 threshold", () => {
  assert(sectionEarned(completeness(), "skills") === 0, "0 skills → 0");
  assert(
    sectionEarned(completeness({ skills: [skill("a")] }), "skills") === 5,
    "1 skill → 5",
  );
  assert(
    sectionEarned(completeness({ skills: [skill("a"), skill("b")] }), "skills") === 5,
    "2 skills → 5",
  );
  const three = completeness({ skills: [skill("a"), skill("b"), skill("c")] });
  assert(sectionEarned(three, "skills") === 10, "3 skills → 10");
  assert(three.sections.find((x) => x.key === "skills")?.complete === true, "3 ticks");

  const many = completeness({
    skills: Array.from({ length: 50 }, (_, i) => skill(`s${i}`)),
  });
  assert(sectionEarned(many, "skills") === 10, "50 skills still 10");

  const withdrawn = completeness({
    skills: [skill("a", false), skill("b", false), skill("c", false)],
  });
  assert(sectionEarned(withdrawn, "skills") === 0, "withdrawn claims do not count");
  assert(
    withdrawn.sections.find((x) => x.key === "skills")?.complete === false,
    "withdrawn claims do not complete skills",
  );
});

suite("accomplishments score the first cert and the awards field", () => {
  const nameOnly = completeness({
    certifications: [completeCert({ issuer: "", issuedYear: null, credentialUrl: null })],
  });
  assert(sectionEarned(nameOnly, "accomplishments") === 1, "cert name is 1");

  const issuedNoExpiry = completeness({
    certifications: [completeCert()],
  });
  assert(
    sectionEarned(issuedNoExpiry, "accomplishments") === 4,
    "issued without expires still counts the date bucket",
  );

  const withAwards = completeness({
    certifications: [completeCert()],
    awards: "Hackathon winner",
  });
  assert(sectionEarned(withAwards, "accomplishments") === 5, "awards add 1");

  const extraCert = completeness({
    certifications: [
      completeCert(),
      completeCert({ id: "c2", name: "Other", issuer: "Other" }),
    ],
    awards: "Hackathon winner",
  });
  assert(
    sectionEarned(extraCert, "accomplishments") === 5,
    "second certification adds 0",
  );

  const awardsOnly = completeness({ awards: "Dean list" });
  // Plan 174: no certification rows awards the full 5%. Awards text is optional
  // garnish and does not change the empty-certs path.
  assert(sectionEarned(awardsOnly, "accomplishments") === 5, "no certs is full credit");
  assert(
    awardsOnly.sections.find((x) => x.key === "accomplishments")?.complete === true,
    "no certs completes the section",
  );

  const halfCert = completeness({
    certifications: [completeCert({ credentialUrl: null })],
  });
  const halfCertSection = halfCert.sections.find(
    (x) => x.key === "accomplishments",
  );
  assert(halfCertSection?.complete === false, "an unfinished cert is not complete");
  assert(
    halfCertSection?.hint?.includes("Finish the certification") === true,
    `a started cert says what is missing, got: ${halfCertSection?.hint}`,
  );
});

suite("resume counts a link or a ready upload once", () => {
  const urlOnly = completeness({ resumeUrl: "https://files.example/cv.pdf" });
  assert(sectionEarned(urlOnly, "resume") === 0, "resumeUrl alone is not hasResume");

  const ready = completeness({}, { hasResume: true });
  assert(sectionEarned(ready, "resume") === 3, "hasResume awards 3");

  const both = completeness(
    { resumeUrl: "https://files.example/cv.pdf" },
    { hasResume: true },
  );
  assert(sectionEarned(both, "resume") === 3, "url + ready is still 3");
});

suite("links count only the three first-class columns", () => {
  const linkedin = completeness({ linkedinUrl: "https://linkedin.com/in/x" });
  assert(sectionEarned(linkedin, "links") === 1.5, "linkedin 1.5");
  const github = completeness({ githubUsername: "tester" });
  assert(sectionEarned(github, "links") === 1.5, "github 1.5");
  const portfolio = completeness({ portfolioUrl: "https://tester.dev" });
  assert(sectionEarned(portfolio, "links") === 1, "portfolio 1");

  // Plan 175: LinkedIn + GitHub award full 4%; portfolio is optional.
  const noPortfolio = completeness({
    linkedinUrl: "https://linkedin.com/in/x",
    githubUsername: "tester",
    portfolioUrl: null,
  });
  assert(sectionEarned(noPortfolio, "links") === 4, "linkedin+github = full 4");
  const noPortfolioLinks = noPortfolio.sections.find((x) => x.key === "links");
  assert(noPortfolioLinks?.complete === true, "linkedin+github completes links");
  assert(
    noPortfolioLinks?.missing.length === 0,
    "portfolio absence is not listed as missing",
  );

  const extra = completeness({
    links: [
      {
        id: "l1",
        type: CandidateLinkType.GITHUB,
        label: "GitHub",
        url: "https://github.com/other",
        sortOrder: 0,
      },
    ],
  });
  assert(sectionEarned(extra, "links") === 0, "extra links add 0");

  const coding = completeness({
    links: [
      {
        id: "l2",
        type: CandidateLinkType.LEETCODE,
        label: null,
        url: "https://leetcode.com/u/alice",
        sortOrder: 0,
      },
      {
        id: "l3",
        type: CandidateLinkType.CODECHEF,
        label: null,
        url: "https://codechef.com/users/alice",
        sortOrder: 1,
      },
    ],
  });
  assert(
    sectionEarned(coding, "links") === 0,
    "LeetCode/CodeChef do not change profile completion %",
  );
});

suite("career preferences count only roles and locations", () => {
  // Plan 176: empty roles + empty locations = full optional credit.
  const empty = completeness({ preference: emptyPref });
  assert(sectionEarned(empty, "preferences") === 3, "empty prefs award full 3");
  assert(
    empty.sections.find((x) => x.key === "preferences")?.complete === true,
    "empty prefs complete the section",
  );
  assert(
    empty.sections.find((x) => x.key === "preferences")?.missing.length === 0,
    "empty prefs name nothing missing",
  );

  const roles = completeness({
    preference: { ...emptyPref, preferredRoles: ["Engineer"] },
  });
  assert(sectionEarned(roles, "preferences") === 1.5, "roles 1.5");
  assert(
    roles.sections.find((x) => x.key === "preferences")?.complete === false,
    "roles alone do not complete preferences",
  );

  const both = completeness({
    preference: {
      ...emptyPref,
      preferredRoles: ["Engineer"],
      preferredLocations: ["Pune"],
    },
  });
  assert(sectionEarned(both, "preferences") === 3, "roles+locations 3");
  assert(
    both.sections.find((x) => x.key === "preferences")?.complete === true,
    "both complete the section",
  );

  const nonCounting = completeness({
    preference: {
      ...emptyPref,
      openToWork: true,
      opportunityTypes: [OpportunityType.FULL_TIME],
      remotePreference: "Remote",
      willingToRelocate: true,
      noticePeriodDays: 30,
      availableFromMonth: 1,
      availableFromYear: 2027,
    },
  });
  assert(
    sectionEarned(nonCounting, "preferences") === 3,
    "openToWork / type / mode / notice / date add nothing beyond optional empty credit",
  );
});

suite("fresher skip awards the full experience 20%", () => {
  const skip = completeness({ hasNoWorkExperience: true });
  assert(sectionEarned(skip, "experience") === 20, "empty rows + flag = 20");
  assert(
    skip.sections.find((x) => x.key === "experience")?.complete === true,
    "fresher skip ticks experience",
  );

  const rowsWin = completeness({
    hasNoWorkExperience: true,
    experience: [completeExperience({ title: "" })],
  });
  assert(
    sectionEarned(rowsWin, "experience") === 0,
    "rows win over an inconsistent flag",
  );

  const emptyNoFlag = completeness({ hasNoWorkExperience: false });
  assert(sectionEarned(emptyNoFlag, "experience") === 0, "no flag, no rows, 0");
});

suite("completeness reaches 100 along both honest paths", () => {
  const withJob = completeness(fullProfile(), { hasResume: true });
  assert(withJob.score === 100, `full experience path is 100, got ${withJob.score}`);
  assert(withJob.score <= 100, "capped");

  const fresher = completeness(
    fullProfile({
      hasNoWorkExperience: true,
      experience: [],
    }),
    { hasResume: true },
  );
  assert(fresher.score === 100, `fresher path is 100, got ${fresher.score}`);

  const noResume = completeness(fullProfile(), { hasResume: false });
  assert(noResume.score === 97, `missing resume caps at 97, got ${noResume.score}`);

  const noAccomplishment = completeness(
    fullProfile({ certifications: [], awards: null }),
    { hasResume: true },
  );
  assert(
    noAccomplishment.score === 100,
    `empty accomplishments still reaches 100, got ${noAccomplishment.score}`,
  );

  const noPortfolio = completeness(
    fullProfile({ portfolioUrl: null }),
    { hasResume: true },
  );
  assert(
    noPortfolio.score === 100,
    `empty portfolio still reaches 100, got ${noPortfolio.score}`,
  );

  const noPreferences = completeness(
    fullProfile({ preference: emptyPref }),
    { hasResume: true },
  );
  assert(
    noPreferences.score === 100,
    `empty career preferences still reaches 100, got ${noPreferences.score}`,
  );
});

suite("every unearned field is named in missing — plan 173", () => {
  const all = (r: ReturnType<typeof computeCompleteness>) => r.sections;
  const miss = (r: ReturnType<typeof computeCompleteness>, key: string) => {
    const s = r.sections.find((x) => x.key === key);
    assert(s !== undefined, `missing section ${key}`);
    return s!.missing;
  };

  // The invariant the whole feature rests on: the union of every section's
  // `missing` accounts for the entire shortfall below 100, so a candidate
  // looking at 80% can always read the remaining 20%.
  const fixtures = [
    completeness({ fullName: "" }),
    completeness(),
    completeness({ headline: "CSE student", phone: "+919876543210" }),
    completeness({ experience: [completeExperience()] }),
    completeness({ education: [completeEducation()] }),
    completeness(fullProfile(), { hasResume: true }),
    completeness(fullProfile(), { hasResume: false }),
  ];
  for (const f of fixtures) {
    for (const s of all(f)) {
      assert(
        (s.fraction === 1) === (s.missing.length === 0),
        `${s.key}: fraction ${s.fraction} must agree with ${s.missing.length} missing`,
      );
    }
  }

  const blank = completeness({ fullName: "" });
  for (const s of all(blank)) {
    // Plans 174 + 176: empty Accomplishments / Career Preferences are optional.
    if (s.key === "accomplishments" || s.key === "preferences") continue;
    assert(s.missing.length > 0, `${s.key} names what is missing on a blank profile`);
  }
  const blankAccomp = blank.sections.find((s) => s.key === "accomplishments");
  assert(miss(blank, "accomplishments").length === 0, "empty accomplishments names nothing");
  assert(blankAccomp?.fraction === 1, "empty accomplishments is fully earned");
  assert(miss(blank, "preferences").length === 0, "empty preferences names nothing");
  assert(
    blank.sections.find((s) => s.key === "preferences")?.fraction === 1,
    "empty preferences is fully earned",
  );
  assert(miss(blank, "basic").includes("Headline"), "headline is named");
  assert(miss(blank, "basic").includes("Phone number"), "phone is named");
  assert(miss(blank, "basic").includes("Full name"), "name is named");
  assert(miss(blank, "basic")[0] === "Headline", "the most valuable field comes first");
  assert(miss(blank, "links").includes("LinkedIn profile"), "links are named one by one");
  assert(miss(blank, "links").includes("GitHub username"), "github is named on blank links");
  assert(
    !miss(blank, "links").includes("Portfolio or website"),
    "portfolio is optional and never named as missing",
  );
  assert(
    miss(
      completeness({
        preference: { ...emptyPref, preferredRoles: ["Engineer"] },
      }),
      "preferences",
    ).join(",") === "Preferred locations",
    "started preferences name the unfinished half",
  );
  assert(miss(blank, "skills")[0] === "At least three skills", "skills ask for three");
  assert(
    miss(completeness({ skills: [skill("a"), skill("b")] }), "skills")[0] ===
      "1 more skill",
    "two skills need one more, singular",
  );

  // A 100% profile has nothing left to name anywhere.
  const full = completeness(fullProfile(), { hasResume: true });
  assert(full.score === 100, "fixture is at 100");
  for (const s of all(full)) {
    assert(s.missing.length === 0, `${s.key} has nothing missing at 100%`);
  }

  // The gap that used to be invisible: required fields are in, the section
  // ticks complete, and the unearned extra is still named.
  const noDescription = completeness({
    experience: [completeExperience({ description: null })],
  });
  const exp = noDescription.sections.find((x) => x.key === "experience");
  assert(exp?.complete === true, "a required-complete role still ticks");
  assert(
    exp?.missing.join(",") === "Role description",
    `and names only the unearned extra, got ${exp?.missing.join(",")}`,
  );

  // A gated section names its unmet required fields, not a generic hint.
  const gated = completeness({
    experience: [completeExperience({ title: "", employmentType: null })],
  });
  assert(miss(gated, "experience").includes("Role title"), "the blank role title is named");
  assert(
    miss(gated, "experience").includes("Employment type"),
    "and so is the blank employment type",
  );

  const halfEducation = completeness({
    education: [completeEducation({ fieldOfStudy: "" })],
  });
  assert(
    miss(halfEducation, "education").includes("Field of study"),
    "education names its own unmet field",
  );

  const halfProject = completeness({
    projects: [
      {
        id: "p1",
        title: "CareerPilot",
        description: "Built it",
        techStack: ["Next.js"],
        repoUrl: "https://github.com/x/y",
        liveUrl: null,
      },
    ],
  });
  const proj = halfProject.sections.find((s) => s.key === "projects");
  assert(
    miss(halfProject, "projects").length === 0,
    "a project without a demo link has nothing missing — the demo is optional",
  );
  assert(
    proj?.complete === true && proj.fraction === 1,
    "and the section is complete at full weight without it",
  );
});

suite("the profile report card lists gaps by score, not by emptiness", () => {
  const review = code("src/components/profile/profile-review.tsx");
  assert(
    review.includes("!c.noGap && c.remaining > 0"),
    "gap cards are selected on remaining score",
  );
  assert(
    !review.includes("empty.filter((c) => !c.noGap)"),
    "and no longer on whether the card is empty",
  );
  assert(review.includes("pw-rv-tofinish"), "each card can name what is left");
  assert(review.includes("card.missing"), "from the completeness section");

  const builder = code("src/features/profile/build-review.ts");
  assert(builder.includes("sections?: readonly SectionStatus[]"), "sections are optional");

  // Every scored section reaches its card, and the one earned card stays out of
  // the gap maths — otherwise the report card would invite a candidate to
  // "finish" a mock interview that cannot move the score either way.
  const built = (over: Partial<CandidateDetail> = {}) => {
    const detail = detailFixture(over);
    const c = computeCompleteness(detail, { hasResume: false });
    return buildProfileReview({
      detail,
      personaLabel: "Student",
      score: c.score,
      resume: null,
      mockInterviewCount: 0,
      verifiedAccomplishments: [],
      verifiedSkills: [],
      stepIndexByKey: {},
      sections: c.sections,
    }).cards;
  };

  const blankCards = built({ fullName: "" });
  const mock = blankCards.find((x) => x.title === "Mock Interview");
  assert(mock?.sectionKey === null, "the mock card sits outside the score");
  assert(mock?.remaining === 0, "and can never be a gap");
  const blankAccompCard = blankCards.find((x) => x.title === "Accomplishments");
  assert(blankAccompCard?.missing.length === 0, "empty Accomplishments is not a gap");
  assert(blankAccompCard?.remaining === 0, "empty Accomplishments reports nothing left");
  const blankPrefsCard = blankCards.find((x) => x.title === "Career Preferences");
  assert(blankPrefsCard?.missing.length === 0, "empty Career Preferences is not a gap");
  assert(blankPrefsCard?.remaining === 0, "empty Career Preferences reports nothing left");
  for (const c of blankCards.filter(
    (x) =>
      x.sectionKey !== null &&
      x.title !== "Accomplishments" &&
      x.title !== "Career Preferences",
  )) {
    assert(c.missing.length > 0, `${c.title} names its gap on a blank profile`);
    assert(c.remaining > 0, `${c.title} reports what it is worth`);
  }

  // The regression itself: a card with data that is still short of full weight.
  const partial = built({ fullName: "Test User", summary: "About me" });
  const basicCard = partial.find((x) => x.title === "Basic Information");
  assert(basicCard?.filled === true, "the basic card has data");
  assert(
    (basicCard?.missing.length ?? 0) > 0,
    "and still names what is missing — the case the old gap list dropped",
  );

  const done = built(fullProfile());
  for (const c of done.filter((x) => x.title !== "Resume")) {
    assert(c.missing.length === 0, `${c.title} is silent once it is at full weight`);
  }

  // Without the sections the report card behaves exactly as it did before.
  const legacy = buildProfileReview({
    detail: detailFixture({ fullName: "" }),
    personaLabel: "Student",
    score: 0,
    resume: null,
    mockInterviewCount: 0,
    verifiedAccomplishments: [],
    verifiedSkills: [],
    stepIndexByKey: {},
  }).cards;
  assert(
    legacy.every((c) => c.missing.length === 0 && c.remaining === 0),
    "sections are genuinely optional",
  );

  const page = code("src/app/profile/page.tsx");
  assert(
    page.includes("sections: completeness.sections"),
    "the profile page hands the sections in",
  );

  const donut = code("src/components/dashboard-hub/stages/score-donut.tsx");
  assert(
    !donut.includes("title={s.complete"),
    "the dashboard no longer hides the breakdown in a title attribute",
  );
  assert(donut.includes("Still to add:"), "it is visible instead");
});

suite("completeness does not take visibility or evidence inputs", () => {
  const src = code("src/features/profile/completeness.ts");
  assert(!src.includes("searchableByRecruiters"), "no visibility input");
  assert(!src.includes("CandidateVisibility"), "visibility is not imported");
  assert(!src.includes("isOtpVerificationRequired"), "OTP flag does not change the score");
  assert(src.includes("hasResume: boolean"), "resume is the only extra input");
  assert(!src.includes('"evidence"'), "evidence is not a scored section");
});

/* ─── Migration safety ───────────────────────────────────────────────────── */

suite("the migration is additive and drops nothing", () => {
  const sql = code(
    "prisma/migrations/20260831120000_candidate_profile_detail/migration.sql",
  );
  assert(!/\bDROP\b/i.test(sql), "no DROP");
  assert(!/\bALTER COLUMN\b/i.test(sql), "no column rewrites");
  // "ON DELETE CASCADE" is a constraint clause, not a data deletion.
  assert(!/\bDELETE\s+FROM\b/i.test(sql), "no data deletion");
  assert(!/\bTRUNCATE\b/i.test(sql), "no truncation");
  // "ON UPDATE CASCADE" is a constraint clause, not a data rewrite.
  assert(!/\bUPDATE\s+\S+\s+SET\b/i.test(sql), "no data rewrites");
  assert(sql.includes('ADD COLUMN "startMonth"'), "education month precision");
  assert(sql.includes('ADD COLUMN "gradeType"'), "grade scale");
  assert(
    sql.includes('ADD COLUMN "claimedByCandidate" BOOLEAN NOT NULL DEFAULT true'),
    "existing claims stay claims",
  );
  assert(sql.includes('CREATE TABLE "CandidateLink"'), "link table");
});

suite("flags and dual-write are untouched by this slice", () => {
  const flags = source("src/lib/feature-flags.ts");
  assert(
    !flags.includes("ENABLE_DUAL_WRITE"),
    "dual-write migration flag retired",
  );
  assert(
    !flags.includes("ENABLE_NEW_CANDIDATE"),
    "candidate migration flag retired",
  );
  assert(
    !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
    "dual-write.ts deleted",
  );
});

suite("StudentProfile is not written; CandidateProfile is the identity source", () => {
  const src = source("src/repositories/candidate-detail.ts");
  const writes = src.split("studentProfile.updateMany").length - 1;
  assert(writes === 0, `legacy mirrors must be gone, found ${writes}`);
  assert(
    !src.includes("studentProfile.findUnique"),
    "never read as a source of truth",
  );
  const page = source("src/app/profile/page.tsx");
  assert(page.includes("getCandidateDetail"), "page reads the canonical tables");
  assert(!page.includes("studentProfile"), "page does not read legacy");
});

/* ─── Grade type enum ────────────────────────────────────────────────────── */

suite("grade type covers the scales Indian institutions actually use", () => {
  const values = Object.values(GradeType);
  for (const v of ["PERCENTAGE", "CGPA_10", "GPA_4", "GRADE", "OTHER"]) {
    assert(values.includes(v as GradeType), `${v} present`);
  }
});

suite("education score type drops Other and caps numeric scales", () => {
  const vocab = code("src/lib/candidate-vocab.ts");
  assert(vocab.includes("SCORE_TYPE_OPTIONS"), "picker options are named");
  assert(vocab.includes('"PERCENTAGE"'), "percentage is offered");
  assert(vocab.includes('"CGPA_10"'), "CGPA is offered");
  assert(vocab.includes('"GPA_4"'), "GPA is offered");
  assert(vocab.includes('"GRADE"'), "letter grade is offered");
  const optionsSlice = vocab.slice(
    vocab.indexOf("SCORE_TYPE_OPTIONS"),
    vocab.indexOf("GRADE_SCORE_MAX"),
  );
  assert(!optionsSlice.includes('"OTHER"'), "Other is not selectable");

  const edu = code("src/components/profile/education-section.tsx");
  assert(edu.includes("PwMenuSelect"), "score type uses the clay menu select");
  assert(edu.includes("SCORE_TYPE_OPTIONS"), "and the filtered option list");
  assert(edu.includes("gradeScoreIssue"), "score is validated against the scale");
  assert(!edu.includes("Object.values(GradeType)"), "enum is not dumped raw into the picker");

  assert(gradeScoreIssue("PERCENTAGE", "101") !== null, "percentage > 100 fails");
  assert(gradeScoreIssue("PERCENTAGE", "100") === null, "percentage 100 is ok");
  assert(gradeScoreIssue("CGPA_10", "10.5") !== null, "CGPA > 10 fails");
  assert(gradeScoreIssue("CGPA_10", "9.2") === null, "CGPA within 10 is ok");
  assert(gradeScoreIssue("GPA_4", "4.1") !== null, "GPA > 4 fails");
  assert(gradeScoreIssue("GPA_4", "3.7") === null, "GPA within 4 is ok");
  assert(gradeScoreIssue("GRADE", "A+") === null, "letter grades stay free text");
});

suite("a score that makes no sense is refused", () => {
  assert(gradeScoreIssue(null, "85") !== null, "a score needs its scale");
  assert(gradeScoreIssue(null, "") === null, "no score, no scale needed");
  assert(gradeScoreIssue("PERCENTAGE", "0") !== null, "0% is not a result");
  assert(gradeScoreIssue("PERCENTAGE", "-5") !== null, "negative fails");
  assert(gradeScoreIssue("PERCENTAGE", "92%") !== null, "units belong in the type");
  assert(gradeScoreIssue("PERCENTAGE", "abc") !== null, "words are not a percentage");
  assert(gradeScoreIssue("PERCENTAGE", "82.555") !== null, "three decimals is noise");
  assert(gradeScoreIssue("PERCENTAGE", "82.55") === null, "two decimals is fine");
  assert(gradeScoreIssue("CGPA_10", "1e1") !== null, "scientific notation is not a CGPA");
  assert(gradeScoreIssue("GRADE", "!!") !== null, "a grade starts with a letter");
  assert(gradeScoreIssue("GRADE", "O") === null, "O is a real grade");
});

suite("education levels are read off the degree, résumé spellings included", () => {
  const cases: [string | null, string][] = [
    ["Secondary (10th)", "TENTH"],
    ["SSC", "TENTH"],
    ["S.S.C.", "TENTH"],
    ["Class X", "TENTH"],
    ["10th", "TENTH"],
    ["Matriculation", "TENTH"],
    ["ICSE", "TENTH"],
    ["Higher Secondary (12th)", "TWELFTH"],
    ["HSC", "TWELFTH"],
    ["Class XII (CBSE)", "TWELFTH"],
    ["Intermediate (MPC)", "TWELFTH"],
    ["Senior Secondary", "TWELFTH"],
    ["10+2", "TWELFTH"],
    ["PUC", "TWELFTH"],
    ["Class XII (CS)", "TWELFTH"],
    ["Diploma", "DIPLOMA"],
    ["Diploma in Computer Engineering", "DIPLOMA"],
    ["Polytechnic Diploma (12 months)", "DIPLOMA"],
    ["ITI", "DIPLOMA"],
    ["PG Diploma in Data Science", "HIGHER"],
    ["PGDM", "HIGHER"],
    ["CA Intermediate", "HIGHER"],
    ["B.Tech", "HIGHER"],
    ["B.E / B.Tech", "HIGHER"],
    ["M.Sc", "HIGHER"],
    ["Ph.D", "HIGHER"],
    [null, "HIGHER"],
    ["", "HIGHER"],
  ];
  for (const [degree, level] of cases) {
    assert(educationLevelOf(degree) === level, `${degree} → ${level}, got ${educationLevelOf(degree)}`);
  }
  assert(
    COLLEGE_DEGREES.every((d) => educationLevelOf(d) === "HIGHER"),
    "the College picker offers no school year or diploma",
  );
  assert(!COLLEGE_DEGREES.includes("Diploma"), "Diploma has its own tab");
  assert(OTHER_EDUCATION_DEGREES.includes("Diploma"), "a second diploma can be added");
  assert(
    !OTHER_EDUCATION_DEGREES.includes("Secondary (10th)") &&
      !OTHER_EDUCATION_DEGREES.includes("Higher Secondary (12th)"),
    "Class X and XII are only added in their tabs",
  );
  assert(canonicalDegree("ssc") === "Secondary (10th)", "SSC folds onto the catalog");
  assert(canonicalDegree("HSC") === "Higher Secondary (12th)", "HSC folds onto the catalog");
});

suite("rows are split into the three slots and read back the way they were saved", () => {
  const row = (degree: string | null, institutionName = "Somewhere") => ({
    degree,
    institutionName,
  });
  // The order the section saves in: college, other degrees, XII, X, diplomas.
  const saved = [
    row("B.Tech", "IIT"),
    row("M.Tech", "IISc"),
    row("Higher Secondary (12th)", "KV"),
    row("Secondary (10th)", "KV"),
    row("Diploma", "Govt Polytechnic"),
  ];
  const slots = assignEducationSlots(saved);
  assert(slots.college?.institutionName === "IIT", "college is the first degree");
  assert(slots.twelfth?.degree === "Higher Secondary (12th)", "XII before the later diploma");
  assert(slots.tenth?.degree === "Secondary (10th)", "Class X");
  assert(
    slots.others.map((r) => r.institutionName).join(",") === "IISc,Govt Polytechnic",
    "the rest stay in order",
  );
  const bare = assignEducationSlots([row(null, "Delhi Public School"), row(null, "NIT Trichy")]);
  assert(bare.college?.institutionName === "NIT Trichy", "a bare school row is not the college");
  assert(bare.others[0]?.institutionName === "Delhi Public School", "it stays an other entry");
});

suite("a score typed with its scale is split for the form", () => {
  assert(inferGradeType("92%")?.gradeType === "PERCENTAGE", "92%");
  assert(inferGradeType("92%")?.grade === "92", "the number alone");
  assert(inferGradeType("8.7/10")?.gradeType === "CGPA_10", "8.7/10");
  assert(inferGradeType("8.7 CGPA")?.grade === "8.7", "8.7 CGPA");
  assert(inferGradeType("3.6 / 4")?.gradeType === "GPA_4", "3.6 / 4");
  assert(inferGradeType("First Class") === null, "words are left to the candidate");
  assert(inferGradeType("85") === null, "a bare number has no scale to infer");
});

suite("education years must follow X → XII / Diploma → college", () => {
  const r = (
    degree: string,
    over: Partial<{ startYear: number | null; graduationYear: number | null; isCurrent: boolean }> = {},
  ) => ({ degree, startYear: null, graduationYear: null, isCurrent: false, ...over });
  const at = (rows: ReturnType<typeof r>[], index: number, field: string) =>
    educationTimelineIssues(rows).find((i) => i.index === index && i.field === field);

  const ok = [
    r("B.Tech", { startYear: 2020, graduationYear: 2024 }),
    r("Higher Secondary (12th)", { graduationYear: 2020 }),
    r("Secondary (10th)", { graduationYear: 2018 }),
  ];
  assert(educationTimelineIssues(ok).length === 0, "a normal path has no issues");

  assert(
    at([r("Secondary (10th)", { graduationYear: 2019 }), r("HSC", { graduationYear: 2020 })], 1, "graduationYear") !== undefined,
    "XII one year after X is refused",
  );
  assert(
    at([r("Secondary (10th)", { graduationYear: 2019 }), r("Diploma", { graduationYear: 2019 })], 1, "graduationYear") !== undefined,
    "a diploma in the same year as X is refused",
  );
  assert(
    at([r("Higher Secondary (12th)", { graduationYear: 2021 }), r("B.Tech", { startYear: 2019 })], 1, "startYear") !== undefined,
    "college before XII is refused",
  );
  assert(
    at([r("Secondary (10th)", { graduationYear: 2019 }), r("B.Tech", { startYear: 2020 })], 1, "startYear") !== undefined,
    "college a year after X is refused",
  );
  assert(
    at([r("Higher Secondary (12th)", { isCurrent: true }), r("B.Tech", { startYear: 2024 })], 1, "startYear") !== undefined,
    "college while still in XII is refused",
  );
  assert(
    at([r("Secondary (10th)", { graduationYear: 2017 }), r("Diploma", { graduationYear: 2020 }), r("B.Tech", { startYear: 2020 })], 2, "startYear") === undefined,
    "lateral entry after a diploma is fine",
  );
  assert(
    at([r("Secondary (10th)"), r("SSC")], 1, "degree") !== undefined,
    "a second Class X is refused",
  );
  assert(
    educationTimelineIssues([r("Secondary (10th)"), r("B.Tech")]).length === 0,
    "rows without years are not judged",
  );

  // The server schema applies the same rules, on the row's own path.
  const blank = {
    institutionName: "", collegeId: "", degree: "", fieldOfStudy: "",
    startMonth: null, startYear: null, endMonth: null, graduationYear: null,
    isCurrent: false, gradeType: "", grade: "", description: "",
  };
  const parsed = educationSectionSchema.safeParse({
    rows: [
      { ...blank, institutionName: "IIT", degree: "B.Tech", fieldOfStudy: "CSE", startYear: 2019, graduationYear: 2023 },
      { ...blank, institutionName: "KV", degree: "Higher Secondary (12th)", fieldOfStudy: "Science (PCM)", graduationYear: 2021 },
    ],
  });
  assert(!parsed.success, "college starting before XII is refused by the server");
  assert(
    !parsed.success && parsed.error.issues.some((i) => i.path.join(".") === "rows.0.startYear"),
    "on the college row's start year",
  );
  const junkName = educationSectionSchema.safeParse({
    rows: [{ ...blank, institutionName: "12345", degree: "B.Tech" }],
  });
  assert(
    !junkName.success && junkName.error.issues.some((i) => i.path.join(".") === "rows.0.institutionName"),
    "a name with no letters is refused",
  );
  const futureX = educationSectionSchema.safeParse({
    rows: [{ ...blank, institutionName: "KV", degree: "Secondary (10th)", graduationYear: new Date().getFullYear() + 1 }],
  });
  assert(!futureX.success, "Class X cannot be passed in the future");
  const fine = educationSectionSchema.safeParse({ rows: [blank, blank, blank] });
  assert(fine.success && fine.data.rows.length === 0, "empty slots are dropped, not refused");
});

suite("education is split into tabbed slides with other education below", () => {
  const src = code("src/components/profile/education-section.tsx");
  assert(src.includes('role="tablist"'), "the slots are tabs");
  for (const label of ['"Class X"', '"XII / Diploma"', '"College"']) {
    assert(src.includes(`label: ${label}`), `a ${label} tab`);
  }
  assert(src.includes('role="tabpanel"'), "each tab controls a slide");
  assert(src.includes("Add other education"), "other education can still be added");
  assert(src.includes("SCHOOL_SCORE_TYPE_OPTIONS"), "school scores are percentage or CGPA");
  assert(src.includes("assignEducationSlots"), "saved rows are split the way completeness splits them");
  assert(src.includes("remapIssues"), "server issues land on the slot they came from");
  const fields = code("src/components/profile/wizard-fields.tsx");
  assert(/<PlusIcon \/>\s*<span>\{children\}<\/span>/.test(fields), "the add button carries an icon");
  const css = source("src/components/profile/profile-wizard.css");
  const add = css.slice(css.indexOf(".pw-add-more {"), css.indexOf("}", css.indexOf(".pw-add-more {")));
  assert(add.includes("border: 1px solid var(--pw-primary)"), "the add button is outlined, not a bare link");
});

/* ─── Plan 136: UI QA findings ───────────────────────────────────────────── */

suite("every dismissal of the sheet asks before dropping edits", () => {
  const src = code("src/components/profile/profile-wizard.tsx");
  // Cancel used to call closeSheet() straight through, so it discarded edits
  // that Escape and the scrim would have asked about.
  const cancelAt = src.indexOf("pw-btn pw-btn-ghost");
  assert(cancelAt !== -1, "the Cancel button exists");
  const cancel = src.slice(cancelAt, src.indexOf("Cancel", cancelAt));
  assert(cancel.includes("onClick={requestClose}"), "Cancel routes through requestClose");
  assert(!cancel.includes("onClick={closeSheet}"), "Cancel is not a silent discard");
  assert(src.includes('if (event.key === "Escape")'), "Escape still closes the sheet");
});

suite("the open sheet is a modal, and the keyboard stays inside it", () => {
  const src = code("src/components/profile/profile-wizard.tsx");
  assert(src.includes('role="dialog"'), "the sheet is a dialog");
  assert(src.includes('aria-modal="true"'), "and a modal one");
  assert(src.includes("aria-labelledby"), "named by its own heading");
  assert(src.includes('event.key !== "Tab"'), "Tab is handled");
  assert(src.includes("FOCUSABLE"), "focusable stops are collected for the cycle");
  assert(src.includes("openerRef"), "focus returns to whatever opened the sheet");
});

suite("no Quick Link stays selected once the sheet is closed", () => {
  const src = code("src/components/profile/profile-wizard.tsx");
  assert(
    src.includes("activeIndex={open ? index : -1}"),
    "the active step is scoped to an open sheet",
  );
});

suite("Quick Links can render every state it sets a class for", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const card = code("src/components/profile/profile-card.tsx");
  if (card.includes("pw-attention")) {
    assert(css.includes(".pw-check-item.pw-attention"), "pw-attention is styled");
  }
  assert(css.includes(".pw-check-optional"), "the optional chip is styled");
  // The chevron implied a control that never existed.
  assert(!card.includes("pw-chev"), "no dead chevron in the performance panel");
  assert(!css.includes(".pw-col-value .pw-chev"), "and no orphaned rule for it");
});

suite("Mock Interview is marked optional rather than unfinished", () => {
  const page = code("src/app/profile/page.tsx");
  const mock = page.slice(page.indexOf('key: "mock"'), page.indexOf('key: "skills"'));
  assert(mock.includes("optional: true"), "the mock step is optional");
  const scoring = code("src/features/profile/completeness.ts");
  assert(!scoring.includes('"mock"'), "and it is still outside the score");
  const card = code("src/components/profile/profile-card.tsx");
  assert(
    card.includes("!step.optional"),
    "an optional step never shows the attention state",
  );
});

suite("menus escape the scrolling sheet instead of clipping inside it", () => {
  const src = code("src/components/profile/wizard-fields.tsx");
  assert(src.includes("createPortal"), "menus are portalled");
  assert(src.includes("useAnchoredMenu"), "and positioned against their trigger");
  assert(src.includes("getBoundingClientRect"), "measured from the viewport");
  assert(src.includes('"scroll", place, true'), "repositioned on any scroll");
  const css = source("src/components/profile/profile-wizard.css");
  assert(css.includes(".pw-anchored"), "the portalled menu carries its own tokens");
});

suite("the profile card cannot strand its own content on short screens", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const card = css.slice(
    css.indexOf(".pw-profile-card {"),
    css.indexOf(".pw-quick-head {"),
  );
  assert(card.includes("max-height"), "a sticky card is capped to the viewport");
  assert(card.includes("overflow: hidden"), "and clips rather than scrolling inside");
  assert(!card.includes("overflow: hidden auto"), "inner auto-scroll is gone");
  assert(css.includes("padding: 8px 16px"), "Quick Links items are compacted");
});

suite("an open sheet leaves Quick Links pinned where it was", () => {
  // Comment-stripped: the rule is explained in prose that names the very
  // property this asserts is absent.
  const css = code("src/components/profile/profile-wizard.css");
  const at = css.indexOf(".pw-root.pw-sheet-open .pw-profile-card");
  assert(at !== -1, "the sheet-open rule exists");
  const rule = css.slice(at, css.indexOf("}", at));
  // `position: relative` cancels sticky, which is what made the card drift
  // away with the page and sometimes scroll out of sight altogether.
  assert(
    !rule.includes("position:"),
    "the open sheet must not re-position the card, only raise it",
  );
  assert(rule.includes("z-index: 45"), "it is still raised above the scrim");
  assert(
    rule.includes("overflow: hidden"),
    "and has no inner scroll of its own while pinned",
  );
  const card = css.slice(css.indexOf(".pw-profile-card {"), css.indexOf(".pw-quick-head {"));
  assert(card.includes("position: sticky"), "the card is sticky to begin with");
});

suite("Profile performance steps aside while a section is open", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const at = css.indexOf(".pw-root.pw-sheet-open .pw-performance-section");
  assert(at !== -1, "performance is addressed for the open state");
  assert(
    css.slice(at, css.indexOf("}", at)).includes("display: none"),
    "and is hidden while editing",
  );
});

suite("the mobile layout keeps Quick Links under the scrim", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const at = css.indexOf(".pw-root.pw-sheet-open .pw-profile-card");
  assert(at !== -1, "the raised-card rule exists");
  const before = css.slice(0, at);
  const guard = before.lastIndexOf("@media (min-width: 1025px)");
  assert(
    guard !== -1 && before.indexOf("}", guard) === -1,
    "raising the card above the scrim is desktop-only",
  );
});

suite("mobile profile overview hides Quick Links and uses preview cards", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const mobile = css.slice(css.indexOf("@media (max-width: 1024px)"));
  const mobileCard = mobile.slice(
    mobile.indexOf(".pw-profile-card {"),
    mobile.indexOf("}", mobile.indexOf(".pw-profile-card {")) + 1,
  );
  assert(
    mobileCard.includes("display: none"),
    "Quick Links is hidden at the mobile breakpoint",
  );
  assert(css.includes(".pw-rv-complete"), "Complete your profile CTA is styled");
  assert(css.includes(".pw-rv-performance"), "review-bottom performance is styled");
  assert(css.includes(".pw-rv-preview"), "section previews are styled");
  assert(css.includes(".pw-rv-card-hit"), "whole-card tap target exists");
  assert(
    mobile.includes(".pw-rv-desktop-list") && mobile.includes("display: none"),
    "desktop filled/empty list is suppressed on mobile",
  );
  assert(
    mobile.includes(".pw-rv-mobile-list") && mobile.includes("display: flex"),
    "wizard-ordered mobile list is shown",
  );

  const review = code("src/components/profile/profile-review.tsx");
  assert(review.includes("pw-rv-complete"), "the CTA is rendered");
  assert(review.includes("pw-rv-mobile-list"), "the ordered list is rendered");
  assert(review.includes("performance"), "performance is passed into the review");
  assert(review.includes("pw-rv-meta-secondary"), "secondary meta can be hidden");
  assert(review.includes("card.preview"), "cards expose a one-line preview");

  const builder = code("src/features/profile/build-review.ts");
  assert(builder.includes("preview:"), "ReviewCard carries preview");
  assert(builder.includes("location:"), "hero meta is structured");
  assert(builder.includes("updatedLabel:"), "updated label is a dedicated field");
  assert(!builder.includes("meta: [place"), "flat meta array is gone");

  const wizard = code("src/components/profile/profile-wizard.tsx");
  assert(
    wizard.includes("performance={performance}"),
    "the wizard forwards performance to the review card",
  );
});

suite("the completion pill survives narrow widths", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const narrow = css.slice(css.indexOf("@media (max-width: 820px)"));
  const pill = narrow.slice(
    narrow.indexOf(".pw-complete-pill {"),
    narrow.indexOf(".pw-section-header-content"),
  );
  assert(pill.length > 0, "the pill is still addressed at 820px");
  assert(!pill.includes("display: none"), "it is compacted, not removed");
});

suite("required fields are marked, announced, and explained", () => {
  const fields = code("src/components/profile/wizard-fields.tsx");
  const req = fields.slice(fields.indexOf('className="pw-req"'));
  assert(req.includes("(required)"), "screen readers hear the word");
  const wizard = code("src/components/profile/profile-wizard.tsx");
  assert(wizard.includes("pw-required-legend"), "the sheet explains the asterisk");

  // What completeness requires must be what the forms mark.
  const marked: [string, string[]][] = [
    [
      "src/components/profile/basic-info-section.tsx",
      ["City", "State / Region", "Country", "Profile Headline", "About"],
    ],
    [
      "src/components/profile/experience-section.tsx",
      ["Company", "Employment type", "Location"],
    ],
    [
      "src/components/profile/education-section.tsx",
      ["College / Institute", "Degree", "Department / field", "School name", "Year of passing"],
    ],
    [
      "src/components/profile/projects-section.tsx",
      ["Project name", "Tech stack", "GitHub"],
    ],
    [
      "src/components/profile/links-section.tsx",
      ["LinkedIn", "GitHub"],
    ],
  ];
  for (const [rel, labels] of marked) {
    const src = code(rel);
    for (const label of labels) {
      const at = src.indexOf('label="' + label + '"');
      assert(at !== -1, rel + ": " + label + " exists");
      const field = src.slice(at, src.indexOf(">", at));
      assert(field.includes("required"), rel + ": " + label + " is marked required");
    }
  }

  const projects = code("src/components/profile/projects-section.tsx");
  const liveAt = projects.indexOf('label="Live URL"');
  assert(liveAt !== -1, "projects: Live URL exists");
  const liveField = projects.slice(liveAt, projects.indexOf(">", liveAt));
  assert(
    !liveField.includes("required"),
    "projects: Live URL stays optional",
  );
});

suite("nothing on the profile blocks a save", () => {
  // The asterisk means "needed to complete this section". Making any of these
  // a hard form requirement would break the standing rule that only /register
  // has mandatory fields.
  for (const rel of [
    "src/components/profile/basic-info-section.tsx",
    "src/components/profile/experience-section.tsx",
    "src/components/profile/education-section.tsx",
    "src/components/profile/projects-section.tsx",
    "src/components/profile/links-section.tsx",
    "src/components/profile/preferences-section.tsx",
  ]) {
    const src = code(rel);
    assert(
      !/<PwInput[^>]*\srequired[\s/>]/.test(src),
      rel + ": no input enforces required",
    );
  }
});

suite("the resume section is built from the wizard's own styling", () => {
  const src = source("src/components/profile/resume-section.tsx");
  const strength = source("src/components/profile/resume-strength.tsx");
  const pair: [string, string][] = [
    ["resume-section.tsx", src],
    ["resume-strength.tsx", strength],
  ];
  for (const [rel, text] of pair) {
    assert(!text.includes("@/components/ui/"), rel + ": no shadcn primitives");
    assert(!text.includes("lucide-react"), rel + ": icons match the wizard");
    assert(!text.includes("text-muted-foreground"), rel + ": no Tailwind tokens");
    assert(text.includes("pw-"), rel + ": uses pw-* classes");
  }
  // The behaviour it wraps is unchanged.
  for (const action of [
    "uploadResumeAction",
    "saveResumeLinkAction",
    "removeResumeAction",
  ]) {
    assert(src.includes(action), action + " still wired");
  }
});

suite("the photo control is never silently absent", () => {
  const media = code("src/components/profile/identity-media.tsx");
  assert(
    !media.includes("avatarUploadEnabled ? <AvatarEditor"),
    "the pencil is not conditionally dropped",
  );
  assert(media.includes("unavailable={!avatarUploadEnabled}"), "it explains itself");
  const editor = code("src/components/profile/avatar-editor.tsx");
  assert(editor.includes("unavailable"), "the editor understands the state");
  assert(editor.includes("disabled={pending || unavailable}"), "and disables itself");
});

suite("one name per section, wizard and report card alike", () => {
  const page = source("src/app/profile/page.tsx");
  const review = source("src/features/profile/build-review.ts");
  for (const title of ["Skills", "Career Preferences", "Accomplishments", "Resume"]) {
    assert(page.includes('"' + title + '"'), "the wizard step is " + title);
    assert(review.includes('"' + title + '"'), "the report card agrees on " + title);
  }
  assert(!review.includes('"Key skills"'), "no second name for Skills");
  assert(
    !review.includes('"Your career preferences"'),
    "no second name for Career Preferences",
  );
});

suite("sentence case in the places QA caught title case", () => {
  assert(
    source("src/components/profile/profile-review.tsx").includes("Open to work"),
    "the hero badge is sentence case",
  );
  assert(
    source("src/components/profile/basic-info-section.tsx").includes(
      'label="Phone number"',
    ),
    "so is the phone label",
  );
});

suite("the page keeps a scroll cue without showing a scrollbar at rest", () => {
  const css = source("src/components/profile/profile-wizard.css");
  assert(
    css.includes("body.pw-profile-page.pw-scrolling .abt-content-scroll"),
    "the thumb is painted while scrolling",
  );
  assert(
    css.includes("scrollbar-color: transparent transparent"),
    "and invisible at rest",
  );
  const wizard = code("src/components/profile/profile-wizard.tsx");
  assert(wizard.includes("pw-scrolling"), "the wizard drives the class");
  assert(wizard.includes("SCROLL_CUE_MS"), "and lets it lapse when scrolling stops");
});

suite("the section heading shows the focus it takes", () => {
  const css = source("src/components/profile/profile-wizard.css");
  assert(
    css.includes(".pw-section-header h2:focus-visible"),
    "the focused heading has a ring",
  );
});

suite("a long display name cannot crowd the Edit control", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const hero = css.slice(
    css.indexOf(".pw-rv-hero-copy h2 {"),
    css.indexOf(".pw-rv-headline {"),
  );
  assert(hero.includes("overflow-wrap"), "long names wrap");
  assert(hero.includes("min-width: 0"), "and the column can shrink");
});

suite("dead profile components are gone", () => {
  for (const rel of [
    "src/components/profile/leave-dialog.tsx",
    "src/components/profile/fields.tsx",
  ]) {
    let exists = true;
    try {
      source(rel);
    } catch {
      exists = false;
    }
    assert(!exists, rel + " should have been deleted");
  }
});

/* ─── Skill catalog (tech, research, engineering) ────────────────────────── */

const squashSkill = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Names whose punctuation IS the name: C, C++ and C# all squash to "c". They
 * are distinct skills, and the exact-key lookup keeps them apart — only the
 * punctuation-insensitive fallback sees them as one, which is why "c" resolves
 * to the language C and the other two are only ever reached by typing them.
 */
const SQUASH_COLLISIONS_ALLOWED = new Set(["c"]);

suite("the catalog holds exactly one spelling per skill", () => {
  const byName = new Map<string, string>();
  for (const entry of CANONICAL_SKILLS) {
    const key = squashSkill(entry.name);
    const clash = byName.get(key);
    assert(
      !clash || SQUASH_COLLISIONS_ALLOWED.has(key),
      `duplicate entry: ${entry.name} and ${clash}`,
    );
    if (!clash) byName.set(key, entry.name);
  }
  for (const name of ["C", "C++", "C#"]) {
    assert(
      canonicalSkillName(name) === name,
      `${name} must survive folding as itself, got ${canonicalSkillName(name)}`,
    );
  }

  // An alias that lands on another entry's name, or that two entries share,
  // makes canonicalSkillName() depend on array order. That is how a catalog
  // quietly starts folding "React" onto "React Native".
  const byAlias = new Map<string, string>();
  for (const entry of CANONICAL_SKILLS) {
    for (const alias of entry.aliases ?? []) {
      assert(alias === alias.toLowerCase(), `alias must be lower-case: ${alias}`);
      assert(alias.trim() === alias, `alias must be trimmed: ${alias}`);
      const key = squashSkill(alias);
      const asName = byName.get(key);
      assert(
        !asName || asName === entry.name,
        `alias "${alias}" on ${entry.name} collides with the skill ${asName}`,
      );
      const other = byAlias.get(key);
      assert(
        !other || other === entry.name,
        `alias "${alias}" is claimed by both ${entry.name} and ${other}`,
      );
      byAlias.set(key, entry.name);
    }
  }
  assert(byAlias.size > 200, `expected a broad alias table, got ${byAlias.size}`);
});

suite("every alias folds onto its canonical spelling", () => {
  for (const entry of CANONICAL_SKILLS) {
    assert(
      canonicalSkillName(entry.name) === entry.name,
      `${entry.name} must be its own canonical form`,
    );
    for (const alias of entry.aliases ?? []) {
      const folded = canonicalSkillName(alias);
      assert(
        folded === entry.name,
        `"${alias}" folded to "${folded}", expected ${entry.name}`,
      );
    }
  }
  // Spelling and spacing are handled by the squash pass, not by listing every
  // permutation as an alias.
  for (const [typed, expected] of [
    ["tailwindcss", "Tailwind CSS"],
    ["Tailwind css", "Tailwind CSS"],
    ["TAILWINDCSS", "Tailwind CSS"],
    ["node js", "Node.js"],
    ["postgre sql", "PostgreSQL"],
    ["scikit learn", "scikit-learn"],
    ["k8s", "Kubernetes"],
  ] as const) {
    assert(
      canonicalSkillName(typed) === expected,
      `"${typed}" should fold to ${expected}, got ${canonicalSkillName(typed)}`,
    );
  }
});

suite("skill names are written the way their own docs write them", () => {
  for (const name of [
    "Tailwind CSS",
    "Node.js",
    "Next.js",
    "TypeScript",
    "JavaScript",
    "PostgreSQL",
    "MongoDB",
    "GraphQL",
    "scikit-learn",
    "PyTorch",
    "TensorFlow",
    "MATLAB",
    "AutoCAD",
    "SolidWorks",
    "LabVIEW",
    "KiCad",
    "STAAD.Pro",
    "LaTeX",
    "MySQL",
  ]) {
    assert(
      CANONICAL_SKILL_NAMES.includes(name),
      `${name} must be spelled exactly that way in the catalog`,
    );
  }
  for (const entry of CANONICAL_SKILLS) {
    assert(entry.name.trim() === entry.name, `${entry.name} has stray whitespace`);
    assert(!entry.name.includes("  "), `${entry.name} has a double space`);
  }
});

suite("the catalog covers tech, research and engineering", () => {
  assert(
    CANONICAL_SKILLS.length >= 300,
    `expected a broad catalog, got ${CANONICAL_SKILLS.length}`,
  );
  const counts = new Map<string, number>();
  for (const entry of CANONICAL_SKILLS) {
    counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1);
  }
  // Every declared group must actually carry skills — an empty group is a
  // promise the picker cannot keep.
  for (const group of SKILL_GROUPS) {
    assert((counts.get(group) ?? 0) > 0, `group ${group} is empty`);
  }
  for (const group of [
    "Research",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Industrial Engineering",
  ]) {
    assert(
      (counts.get(group) ?? 0) >= 10,
      `${group} needs real depth, got ${counts.get(group) ?? 0}`,
    );
  }
  for (const name of [
    "Finite Element Analysis",
    "Computational Fluid Dynamics",
    "Research Methodology",
    "Literature Review",
    "PCB Design",
    "Structural Analysis",
    "Process Simulation",
    "Six Sigma",
  ]) {
    assert(CANONICAL_SKILL_NAMES.includes(name), `${name} is missing`);
  }
});

suite("search finds skills a substring match never would", () => {
  const first = (q: string) => searchCanonicalSkills(q, 5)[0]?.name;
  // Aliases carry the query to a name that shares nothing with it.
  assert(first("k8s") === "Kubernetes", `k8s -> ${first("k8s")}`);
  assert(first("dsa") === "Data Structures & Algorithms", `dsa -> ${first("dsa")}`);
  assert(first("cfd") === "Computational Fluid Dynamics", `cfd -> ${first("cfd")}`);
  assert(first("iot") === "Internet of Things", `iot -> ${first("iot")}`);

  // An exact alias outranks a name that merely starts with the query.
  assert(first("ml") === "Machine Learning", `ml -> ${first("ml")}`);
  assert(first("fea") === "Finite Element Analysis", `fea -> ${first("fea")}`);
  // An exact name still wins over everything.
  assert(first("java") === "Java", `java -> ${first("java")}`);

  // Misspacing and casing are not a dead end.
  assert(first("tailwindcss") === "Tailwind CSS", `tailwindcss -> ${first("tailwindcss")}`);
  assert(first("solid works") === "SolidWorks", `solid works -> ${first("solid works")}`);

  // A field name browses that field.
  const civil = searchCanonicalSkills("civil", 5);
  assert(civil.length >= 3, "typing a discipline lists its skills");
  assert(
    civil.every((h) => h.group === "Civil Engineering"),
    "and only that discipline",
  );

  // An empty query is a curated spread, never the whole catalog.
  const idle = searchCanonicalSkills("", 40);
  assert(idle.length > 0 && idle.length <= 40, `idle list is ${idle.length}`);
  assert(
    idle.length < CANONICAL_SKILLS.length,
    "the idle list must not be the entire catalog",
  );
  assert(new Set(idle.map((h) => h.group)).size >= 6, "and it spans several areas");
});

suite("both skill pickers search the same catalog", () => {
  const combobox = code("src/components/profile/skill-combobox.tsx");
  assert(
    combobox.includes("searchCanonicalSkills"),
    "the Skills picker ranks with the catalog matcher",
  );
  assert(
    !combobox.includes("s.name.toLowerCase().includes(q)"),
    "and no longer falls back to a plain substring filter",
  );

  // The project Tech stack field is the pattern this was modelled on, so it
  // gets the same alias search rather than a second, weaker one.
  const projects = code("src/components/profile/projects-section.tsx");
  assert(projects.includes("suggestions={CANONICAL_SKILL_NAMES}"), "same catalog");
  assert(
    projects.includes("searchSuggestions={searchCanonicalSkillNames}"),
    "same alias-aware search",
  );
  assert(projects.includes("normalize={canonicalSkillName}"), "same folding");

  const fields = code("src/components/profile/wizard-fields.tsx");
  assert(fields.includes("search?: (query: string)"), "PwSuggest accepts a matcher");
});

suite("the profile page does not resolve the whole catalog on load", () => {
  const page = code("src/app/profile/page.tsx");
  assert(
    page.includes("getSkillsByNames(PROFILE_QUICK_SKILLS)"),
    "only the quick adds are pre-resolved",
  );
  assert(
    !page.includes("getSkillsByNames(CANONICAL_SKILL_NAMES)"),
    "a few hundred name comparisons per page load is not a lookup",
  );
  // Everything else still reaches a Skill row on the way in.
  const section = code("src/components/profile/skills-section.tsx");
  assert(section.includes("resolveSkillAction"), "unresolved names resolve on add");
});

/* ─── Validation errors belong under their field ─────────────────────────── */

suite("a rejected save says which field it is about", () => {
  const actions = code("src/app/actions/candidate-profile-actions.ts");
  assert(actions.includes("export type FieldIssue"), "issues are a typed shape");
  assert(
    actions.includes("issues?: FieldIssue[]"),
    "the failure envelope can carry them",
  );
  assert(actions.includes("function fieldIssues"), "zod paths are collected");
  assert(
    actions.includes('issue.path.join(".")'),
    "as dotted paths the form can address",
  );
  // Every section boundary returns them, not just the first one written.
  const returns = actions.split("issues: fieldIssues(parsed.error)").length - 1;
  assert(returns >= 2, `expected the section boundaries to carry issues, got ${returns}`);
});

suite("the toast is the fallback, not the default", () => {
  const hook = code("src/components/profile/use-section-save.ts");
  assert(
    hook.includes("const placed = placeIssues?.(result.issues ?? []) ?? 0"),
    "the form gets first refusal on every failure",
  );
  assert(
    hook.includes("if (placed === 0) toast.error(result.message)"),
    "and a toast only fires when nothing could be placed",
  );
});

suite("server errors clear the moment the field changes", () => {
  const src = code("src/components/profile/field-issues.ts");
  assert(src.includes("setError"), "issues become field errors");
  assert(src.includes("shouldFocus: true"), "the first one pulls the view to it");
  assert(
    src.includes("owned.current.delete(name)") && src.includes("clearErrors"),
    "and are dropped as soon as that field is edited",
  );
  // A path the form does not have must not count as placed, or the failure
  // would be swallowed: no toast, no inline message, nothing.
  assert(src.includes("function pathExists"), "unknown paths are detected");
  assert(src.includes("if (!pathExists(values, path)) continue"), "and skipped");
});

suite("every section form routes its errors to its own fields", () => {
  for (const rel of [
    "src/components/profile/basic-info-section.tsx",
    "src/components/profile/experience-section.tsx",
    "src/components/profile/education-section.tsx",
    "src/components/profile/projects-section.tsx",
    "src/components/profile/links-section.tsx",
    "src/components/profile/preferences-section.tsx",
    "src/components/profile/accomplishments-section.tsx",
  ]) {
    const src = code(rel);
    assert(src.includes("useServerFieldErrors"), `${rel}: has a sink`);
    assert(src.includes("placeIssues"), `${rel}: passes it to save()`);
    // Whitespace-free, because these calls wrap differently per section.
    const flat = src.replace(/\s+/g, "");
    assert(
      flat.includes("placeIssues)") || flat.includes("placeIssues,)"),
      `${rel}: the sink actually reaches save()`,
    );
  }
  // The country input is named for what it shows, not for what is stored.
  const basic = code("src/components/profile/basic-info-section.tsx");
  assert(
    basic.includes('{ countryCode: "country" }'),
    "a schema field with a different form name is aliased",
  );
});

suite("date pairs are judged as they are picked", () => {
  const cases: [string, string, string][] = [
    ["src/components/profile/experience-section.tsx", "endYear", "cannot end before it started"],
    ["src/components/profile/education-section.tsx", "graduationYear", "cannot be before the start date"],
    ["src/components/profile/accomplishments-section.tsx", "expiresYear", "cannot expire before it was issued"],
  ];
  for (const [rel, field, message] of cases) {
    const src = code(rel);
    assert(src.includes('mode: "onChange"'), `${rel}: validates while editing`);
    assert(src.includes("endBeforeStart"), `${rel}: uses the shared rule`);
    assert(src.includes(message), `${rel}: says what is wrong in words`);
    // The rule lives on the path the schema names, so a live failure and a
    // server one cannot land in two different places.
    assert(
      src.includes(`.${field}\`}`) || src.includes(`${field}?.message`),
      `${rel}: the error surfaces on ${field}`,
    );
    assert(
      src.includes(`errors.rows?.[index]?.${field}?.message`),
      `${rel}: and is rendered by that field`,
    );
    // Editing any half of either date re-runs it, so a fix registers whichever
    // input the candidate corrects.
    assert(src.includes("void trigger("), `${rel}: siblings re-run the rule`);
  }
});

suite("an invalid date pair looks invalid", () => {
  const fields = code("src/components/profile/wizard-fields.tsx");
  // It used to go red only while empty, so a filled-but-wrong pair stayed
  // looking correct while the message sat somewhere else entirely.
  assert(
    fields.includes('className={`pw-menu-select-trigger${invalid ? " pw-invalid" : ""}`}'),
    "a set-but-wrong value still shows as invalid",
  );
  const css = source("src/components/profile/profile-wizard.css");
  assert(css.includes(".pw-menu-select-trigger.pw-invalid"), "and is styled");
  // The message renders inside the field, so it displaces content instead of
  // floating over another section.
  assert(css.includes(".pw-field.pw-has-error .pw-error-msg"), "inline, in flow");
  const errorRule = css.slice(
    css.indexOf(".pw-error-msg {"),
    css.indexOf("}", css.indexOf(".pw-error-msg {")),
  );
  assert(!errorRule.includes("position: absolute"), "never positioned over anything");
  assert(!errorRule.includes("position: fixed"), "and never pinned to the viewport");
});

suite("the date rule itself", () => {
  const msg = "nope";
  const feb2026 = { month: 2, year: 2026 };
  const jan2026 = { month: 1, year: 2026 };
  assert(endBeforeStart(feb2026, jan2026, msg) === msg, "Feb 2026 → Jan 2026 fails");
  assert(endBeforeStart(jan2026, feb2026, msg) === null, "Jan 2026 → Feb 2026 passes");
  assert(endBeforeStart(feb2026, feb2026, msg) === null, "the same month passes");
  // An unfinished date is not a wrong one.
  assert(
    endBeforeStart(feb2026, { month: null, year: null }, msg) === null,
    "no end year yet is not an error",
  );
  assert(
    endBeforeStart({ month: null, year: null }, jan2026, msg) === null,
    "no start year yet is not an error either",
  );
  // A missing month must not invent a failure: a start defaults to the first
  // month of its year and an end to the last.
  assert(
    endBeforeStart({ month: null, year: 2026 }, { month: null, year: 2026 }, msg) === null,
    "same year, months unpicked, passes",
  );
  assert(
    endBeforeStart({ month: 6, year: 2026 }, { month: null, year: 2025 }, msg) === msg,
    "an earlier end year still fails",
  );

  const now = new Date();
  assert(isFuture(12, now.getFullYear() + 1), "next year is the future");
  assert(!isFuture(1, now.getFullYear() - 1), "last year is not");
  assert(!isFuture(null, null), "an empty date is not the future");
});

/* ─── Plan 137: catalogs and form fixes ──────────────────────────────────── */

suite("the skills picker offers the catalog and nothing else", () => {
  const src = code("src/components/profile/skill-combobox.tsx");
  // The Skill table was seeded from free text, so it holds "Tailwinf CSS" and
  // whole pasted stacks. Those were being listed beside real skills.
  assert(!src.includes("/api/skills/search"), "no query against the seeded table");
  assert(!src.includes("fetch("), "no network call at all");
  assert(!src.includes("setResults"), "and no results state left behind");
  assert(src.includes("searchCanonicalSkills"), "the catalog is the source");
  // Free text still has a way in.
  assert(src.includes("onEnterFreeText"), "typing something new still works");
  assert(src.includes("OTHER_ITEM"), "and Other is still offered");
});

suite("the city catalog is derived from data already in the repo", () => {
  const script = code("prisma/scripts/build-city-catalog.ts");
  assert(
    script.includes("prisma") && script.includes("colleges.json"),
    "built from the college dataset",
  );
  const generated = source("src/lib/city-catalog.generated.ts");
  assert(generated.includes("GENERATED"), "the output says so");
  assert(CITY_NAMES.length > 500, `expected real coverage, got ${CITY_NAMES.length}`);
  assert(STATE_NAMES.length >= 28, `expected the states, got ${STATE_NAMES.length}`);

  // The 6 MB source must never be read at request time.
  for (const rel of [
    "src/lib/city-catalog.ts",
    "src/components/profile/basic-info-section.tsx",
  ]) {
    assert(!code(rel).includes("colleges.json"), `${rel} does not read the dataset`);
  }

  // One entry per place: the dataset holds both Bangalore and Bengaluru.
  const lower = CITY_NAMES.map((c) => c.toLowerCase());
  assert(new Set(lower).size === lower.length, "no duplicate city entries");
  assert(!CITY_NAMES.includes("Bangalore"), "old spellings are folded away");
  assert(CITY_NAMES.includes("Bengaluru"), "and the current one is kept");
});

suite("a city knows its state, and a state never guesses a city", () => {
  assert(stateForCity("Pune") === "Maharashtra", "Pune is in Maharashtra");
  assert(stateForCity("Noida") === "Uttar Pradesh", "Noida is in UP");
  // Old spellings and nicknames resolve to the same place.
  assert(stateForCity("Bangalore") === "Karnataka", "Bangalore still resolves");
  assert(stateForCity("vizag") === "Andhra Pradesh", "so do nicknames");
  assert(canonicalCityName("gurgaon") === "Gurugram", "renames fold");
  assert(stateForCity("Nowhereville") === null, "an unknown place says so");
  assert(canonicalCityName("Nowhereville") === "Nowhereville", "and is kept as typed");

  // The catalog exposes no way to go the other way.
  const src = code("src/lib/city-catalog.ts");
  assert(!/citiesForState|citiesInState/.test(src), "no state → city lookup exists");
  const basic = code("src/components/profile/basic-info-section.tsx");
  assert(basic.includes("stateForCity"), "the city field fills the state");
  assert(
    !basic.includes("setValue(\"locationCity\""),
    "and nothing ever writes the city for the candidate",
  );
  assert(
    basic.includes("onlyIfEmpty"),
    "a state the candidate typed is never overwritten",
  );
});

suite("city search reaches the big cities first", () => {
  assert(searchCities("pun", 3)[0] === "Pune", "pun -> Pune");
  assert(searchCities("mum", 3)[0] === "Mumbai", "mum -> Mumbai");
  // "ban" no longer appears in "Bengaluru" at all — the old spelling carries it.
  assert(searchCities("ban", 3)[0] === "Bengaluru", "ban -> Bengaluru");
  assert(searchCities("trichy", 2)[0] === "Tiruchirappalli", "old name finds new");
  assert(searchCities("", 5).length === 5, "an empty query still suggests");
  assert(searchStates("mah", 3)[0] === "Maharashtra", "states search too");
});

suite("every place field draws on the same city catalog", () => {
  for (const [rel, note] of [
    ["src/components/profile/basic-info-section.tsx", "profile city"],
    ["src/components/profile/experience-section.tsx", "experience location"],
    ["src/components/profile/preferences-section.tsx", "preferred locations"],
  ] as const) {
    const src = code(rel);
    assert(src.includes("city-catalog"), `${note} uses the catalog`);
    assert(src.includes("searchCities"), `${note} searches it`);
  }
});

suite("B.E and B.Tech are one degree, and departments follow the degree", () => {
  // Widened: the list is `as const`, so the old spellings are not even
  // assignable to its element type — which is half the point.
  const degrees: readonly string[] = DEGREES;
  assert(degrees.includes("B.E / B.Tech"), "the merged entry exists");
  assert(!degrees.includes("B.E"), "and the two halves are gone");
  assert(!degrees.includes("B.Tech"), "both of them");
  assert(degrees.includes("M.E / M.Tech"), "the same is done for M.E / M.Tech");
  // Rows saved before the merge still resolve.
  for (const typed of ["B.E", "b.tech", "btech", "BE"]) {
    assert(
      canonicalDegree(typed) === "B.E / B.Tech",
      `${typed} folds onto the merged degree, got ${canonicalDegree(typed)}`,
    );
  }
  assert(degrees.length >= 35, `the list grew, got ${degrees.length}`);

  // A degree offers its own branches, not everyone else's.
  const btech = departmentsForDegree("B.Tech");
  assert(
    btech.includes("Computer Science and Engineering (CSE)"),
    "engineering for B.Tech",
  );
  assert(!btech.includes("Marketing"), "and not management");
  assert(
    btech.includes("Artificial Intelligence And Data Science"),
    "AI & DS is offered for B.Tech",
  );
  const bcom = departmentsForDegree("B.Com");
  assert(bcom.includes("Accounting and Finance"), "commerce for B.Com");
  assert(!bcom.includes("Mechanical Engineering"), "and not engineering");
  assert(
    departmentsForDegree("MBBS").includes("General Medicine"),
    "medicine for MBBS",
  );
  assert(
    departmentsForDegree("Higher Secondary (12th)").includes("Science (PCM)"),
    "school streams for school",
  );
  // Anything unrecognised must not narrow the list.
  assert(
    departmentsForDegree("Ph.D").length === FIELDS_OF_STUDY.length,
    "a Ph.D can be in anything",
  );
  assert(
    departmentsForDegree("Something Invented").length === FIELDS_OF_STUDY.length,
    "an unknown degree offers everything",
  );

  const section = code("src/components/profile/education-section.tsx");
  assert(
    section.includes("departmentsForDegree(degree"),
    "the Department field reads the degree beside it",
  );
  assert(
    section.includes("maxSuggestions={80}"),
    "department suggestions are not capped at a dozen rows",
  );
});

suite("the unsaved-changes warning sits above the buttons and is hard to miss", () => {
  const css = source("src/components/profile/profile-wizard.css");
  const rule = css.slice(
    css.indexOf(".pw-leave-pop {"),
    css.indexOf("}", css.indexOf(".pw-leave-pop {")),
  );
  // It used to overlap the actions row by 8px and be white on white.
  assert(rule.includes("bottom: calc(100% + 8px)"), "fully above the buttons");
  assert(!rule.includes("bottom: calc(100% - 8px)"), "not overlapping them");
  assert(rule.includes("var(--pw-warning-soft)"), "carries the warning colour");
  assert(rule.includes("var(--pw-warning)"), "including its border");
  assert(rule.includes("left: 20px") && rule.includes("right: 20px"), "spans the bar");
  const wizard = code("src/components/profile/profile-wizard.tsx");
  assert(wizard.includes("pw-leave-head"), "and leads with an icon");
});

suite("basic info gives the headline its own row", () => {
  const src = code("src/components/profile/basic-info-section.tsx");
  const headlineAt = src.indexOf('label="Profile Headline"');
  assert(headlineAt !== -1, "the headline field exists");
  // The row it opens must be the single-column one, not the row holding
  // Country and Gender.
  const rowStart = src.lastIndexOf("<PwRow", headlineAt);
  assert(
    src.slice(rowStart, headlineAt).includes("cols={1}"),
    "the headline has a row to itself",
  );
  const genderAt = src.indexOf('label="Gender"');
  const genderRow = src.lastIndexOf("<PwRow", genderAt);
  assert(
    src.slice(genderRow, genderAt).includes("cols={2}"),
    "and the row above it holds Country and Gender",
  );
  assert(genderRow < rowStart, "with the headline below it");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
