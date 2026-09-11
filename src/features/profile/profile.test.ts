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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CandidateGender,
  CandidateLinkType,
  CandidatePersona,
  GradeType,
  OpportunityType,
} from "@prisma/client";
import { normalizeGithubUsername } from "@/lib/validations/candidate-profile";
import {
  pickPrimaryEducation,
  pickPrimaryExperience,
  toMonthDate,
  totalExperienceMonths,
} from "@/repositories/candidate-primary";
import { computeCompleteness } from "@/features/profile/completeness";
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
  isCurrent: false,
  startYear: null,
  startMonth: null,
  graduationYear: null,
  endMonth: null,
  sortOrder: 0,
  ...over,
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

suite("legacy skill sync is additive — it can no longer delete claims", () => {
  const src = source("src/repositories/dual-write.ts");
  const fn = src.slice(
    src.indexOf("export async function syncCandidateSkillsFromLegacy"),
    src.indexOf("export async function syncProfileOwnedEducation"),
  );
  assert(fn.length > 0, "function located");
  assert(!fn.includes("candidateSkill.delete"), "no delete of skill rows");
  assert(!fn.includes("deleteMany"), "no bulk delete");
  assert(fn.includes("upsert"), "still mirrors declared skills");
  // Scenario from the brief: 15 canonical skills, 10 in the legacy array. The
  // legacy write must not touch the other 5.
  assert(
    !fn.includes("declaredIds"),
    "no set-difference pass that could prune canonical rows",
  );
});

suite("legacy skill sync does not overwrite the candidate's own rating", () => {
  const src = source("src/repositories/dual-write.ts");
  const fn = src.slice(
    src.indexOf("export async function syncCandidateSkillsFromLegacy"),
    src.indexOf("export async function syncProfileOwnedEducation"),
  );
  assert(fn.includes("update: {}"), "existing rows are left alone");
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
  const dualWrite = source("src/repositories/dual-write.ts");
  const deletesInDetail = detail.split("candidateSkill.deleteMany").length - 1;
  assert(deletesInDetail === 1, "exactly one deletion site");
  assert(
    !dualWrite.includes("candidateSkill.delete"),
    "the legacy path has none",
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
  const fn = src.slice(
    src.indexOf("export async function getCandidateDetail"),
    src.indexOf("/* ─── Legacy compatibility mirrors"),
  );
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
  const src = source("src/repositories/dual-write.ts");
  assert(
    src.includes("if (await hasCandidateAuthoredEducation(tx, userId)) return;"),
    "education guard",
  );
  assert(
    src.includes("if (await hasCandidateAuthoredExperience(tx, userId)) return;"),
    "experience guard",
  );
});

/* ─── Legacy mirroring direction ─────────────────────────────────────────── */

suite("mirrors run canonical → legacy and use the primary row", () => {
  const src = source("src/repositories/candidate-detail.ts");
  assert(
    src.includes("pickPrimaryEducation(rows)"),
    "education mirror picks the primary row",
  );
  assert(
    src.includes("pickPrimaryExperience(shaped)"),
    "experience mirror picks the primary row",
  );
  // The mirror writes college/collegeId/graduationYear and never reads them back.
  const mirror = src.slice(
    src.indexOf("async function mirrorEducationToLegacy"),
    src.indexOf("async function mirrorExperienceToLegacy"),
  );
  assert(mirror.includes("studentProfile.updateMany"), "writes the legacy row");
  assert(
    !mirror.includes("studentProfile.findUnique"),
    "never reads legacy as a source",
  );
});

suite("emptying a section clears the legacy mirror rather than leaving it stale", () => {
  const src = code("src/repositories/candidate-detail.ts");
  const edu = src.slice(
    src.indexOf("async function mirrorEducationToLegacy"),
    src.indexOf("async function mirrorExperienceToLegacy"),
  );
  assert(edu.includes("primary?.institutionName ?? null"), "college cleared");
  assert(edu.includes("primary?.graduationYear ?? null"), "grad year cleared");
  assert(!edu.includes("if (!primary) return;"), "no early return on empty");

  const exp = src.slice(src.indexOf("async function mirrorExperienceToLegacy"));
  const body = exp.slice(0, exp.indexOf("async function mirrorSkillsToLegacy"));
  assert(body.includes("primary?.companyName ?? null"), "organization cleared");
  assert(!body.includes("if (rows.length === 0) return;"), "no early return");
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
  assert(src.includes("prisma.enrollment.findMany"), "challenge days from Enrollment");
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
    education: [completeEducation()],
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
  assert(blank.score === 2, `empty name still has persona 2%, got ${blank.score}`);

  const again = completeness({ fullName: "" });
  assert(again.score === blank.score, "same input, same score");
  assert(blank.sections.length === 9, "every section reported");
  assert(blank.score <= 100, "never above 100");
});

suite("every basic field has its own weight", () => {
  const personaOnly = completeness({ fullName: "" });
  assert(personaOnly.score === 2, `persona 2%, got ${personaOnly.score}`);

  const nameAndPersona = completeness();
  assert(nameAndPersona.score === 6, `name 4 + persona 2, got ${nameAndPersona.score}`);

  const withHeadline = completeness({ headline: "Final-year CSE student" });
  assert(withHeadline.score === 11, `+headline 5, got ${withHeadline.score}`);

  const withAbout = completeness({
    headline: "Final-year CSE student",
    summary: "About me",
  });
  assert(withAbout.score === 14, `+about 3, got ${withAbout.score}`);

  const withPhone = completeness({ phone: "+919876543210" });
  assert(withPhone.score === 9, `+phone 3, got ${withPhone.score}`);

  const badPhone = completeness({ phone: "   " });
  assert(badPhone.score === 6, "whitespace phone does not count");
  const invalidPhone = completeness({ phone: "abc" });
  assert(invalidPhone.score === 6, "invalid phone does not count");

  const withCity = completeness({ locationCity: "Pune" });
  assert(withCity.score === 8, `+city 2, got ${withCity.score}`);
  const withRegion = completeness({ locationRegion: "Maharashtra" });
  assert(withRegion.score === 8, `+state 2, got ${withRegion.score}`);
  const withCountry = completeness({ countryCode: "IN" });
  assert(withCountry.score === 8, `+country 2, got ${withCountry.score}`);
  const withGender = completeness({ gender: CandidateGender.FEMALE });
  assert(withGender.score === 8, `+gender 2, got ${withGender.score}`);
  const noGender = completeness({ gender: null });
  assert(noGender.score === 6, "null gender does not count");

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

suite("education is gated on required fields of entry #1", () => {
  const missingDegree = completeness({
    education: [completeEducation({ degree: null })],
  });
  assert(sectionEarned(missingDegree, "education") === 0, "missing degree gates to 0");

  const missingField = completeness({
    education: [completeEducation({ fieldOfStudy: " " })],
  });
  assert(sectionEarned(missingField, "education") === 0, "missing field gates to 0");

  const requiredOnly = completeness({
    education: [
      completeEducation({
        gradeType: null,
        grade: null,
        description: null,
      }),
    ],
  });
  assert(
    sectionEarned(requiredOnly, "education") === 13,
    `required education is 13, got ${sectionEarned(requiredOnly, "education")}`,
  );
  assert(
    requiredOnly.sections.find((x) => x.key === "education")?.complete === true,
    "optional score fields do not block the tick",
  );

  const full = completeness({ education: [completeEducation()] });
  assert(sectionEarned(full, "education") === 15, "optionals bring education to 15");

  const current = completeness({
    education: [
      completeEducation({
        isCurrent: true,
        graduationYear: null,
        endMonth: null,
        gradeType: null,
        grade: null,
        description: null,
      }),
    ],
  });
  assert(
    sectionEarned(current, "education") === 13,
    "currently studying satisfies the end date",
  );

  const extraIgnored = completeness({
    education: [
      completeEducation(),
      completeEducation({ id: "e2", institutionName: "Other" }),
    ],
  });
  assert(sectionEarned(extraIgnored, "education") === 15, "second education adds 0");
});

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
  assert(sectionEarned(three, "projects") === 10, "name+desc+stack is 10");

  const emptyStack = completeness({
    projects: [completeProject({ techStack: [], repoUrl: null, liveUrl: null })],
  });
  assert(
    sectionEarned(emptyStack, "projects") === 7,
    "empty tech stack does not count",
  );

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
  assert(sectionEarned(awardsOnly, "accomplishments") === 1, "awards alone is 1");
  assert(
    awardsOnly.sections.find((x) => x.key === "accomplishments")?.complete === false,
    "awards without a cert do not tick the section",
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
});

suite("career preferences count only roles and locations", () => {
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
    sectionEarned(nonCounting, "preferences") === 0,
    "openToWork / type / mode / notice / date add 0",
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
    noAccomplishment.score === 95,
    `missing accomplishments caps at 95, got ${noAccomplishment.score}`,
  );
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
    flags.includes('process.env.ENABLE_DUAL_WRITE === "true"'),
    "dual-write flag unchanged",
  );
  assert(
    flags.includes('process.env.ENABLE_NEW_CANDIDATE === "true"'),
    "candidate flag unchanged",
  );
  const runDualWrite = source("src/repositories/dual-write.ts");
  assert(runDualWrite.includes("export async function runDualWrite"), "still there");
});

suite("StudentProfile is still written, and still not the read source", () => {
  const src = source("src/repositories/candidate-detail.ts");
  const writes = src.split("studentProfile.updateMany").length - 1;
  assert(writes >= 4, `legacy mirrors still run, found ${writes}`);
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
