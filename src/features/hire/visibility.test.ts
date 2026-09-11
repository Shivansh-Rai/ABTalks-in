/**
 * The recruiter-discovery gate — run with:
 *   npm run test:visibility
 *
 * No network, no database. Two kinds of check:
 *
 *  1. The gate itself has the shape it claims to have.
 *  2. Every query in `/hire` that loads candidate rows actually applies it.
 *
 * (2) is a source scan, which is unusual for a unit test and deliberate. The
 * failure this guards against is not a wrong boolean, it is a *missing clause*:
 * before this change the program path was gated and the challenge and hackathon
 * paths were not, so a challenge participant who had never been made searchable
 * could be shortlisted and, at CONTACT_SHARED, have their details released. A
 * shape assertion cannot catch that. A fifth track added next quarter without
 * the gate is the same bug, and this is what fails when someone writes it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  RECRUITER_FIELD_POLICY,
  searchableUserWhere,
} from "@/repositories/talent";
import { applyProfileSchema } from "@/lib/validations/program";
import { memberEligibilityWhere } from "@/features/hire/pool-policy";
import { evaluateHardFilters } from "@/features/hire/score-candidate";
import { findTrack } from "@/features/hire/track-registry";
import type { JobSpec, ScoreableMember } from "@/features/hire/types";

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

console.log("\nrecruiter visibility gate");

suite("the gate requires searchable, not-withdrawn, not-deleted", () => {
  const g = searchableUserWhere() as {
    deletedAt: null;
    visibility: { is: { searchableByRecruiters: boolean; withdrawnAt: null } };
  };
  assert(g.deletedAt === null, "deleted users must be excluded");
  assert(
    g.visibility.is.searchableByRecruiters === true,
    "searchableByRecruiters must be required true",
  );
  assert(
    g.visibility.is.withdrawnAt === null,
    "a withdrawn candidate must be excluded even if the flag is still true",
  );
});

suite("the gate is not openToWork", () => {
  // Two different questions: may a recruiter find you, and are you looking.
  // If these ever get wired together, someone marking themselves open to work
  // silently becomes discoverable — or worse, the reverse.
  assert(
    !JSON.stringify(searchableUserWhere()).includes("openToWork"),
    "searchableUserWhere must not reference openToWork",
  );
});

suite("the pool clause is not openToWork either", () => {
  // The gate above is one of two places a "looking for work" flag could quietly
  // become a discovery rule. This is the other one.
  assert(
    !JSON.stringify(memberEligibilityWhere(["cohort_1"])).includes("openToWork"),
    "the pool clause must not filter on openToWork",
  );
});

suite("the open-to-work badge did not smuggle salary onto a card", () => {
  // `CandidatePreference` carries openToWork and the candidate's expected salary
  // on the same row, and the recruiter badge reads that row. The badge is fine;
  // the number beside it is admin-only and must never make the same trip.
  const src = readFileSync(
    join(process.cwd(), "src/features/hire/to-public-match.ts"),
    "utf8",
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    !code.includes("expectedSalary"),
    "the candidate's declared salary must never reach MatchCardData",
  );
});

suite("the pool clause describes the pool and nothing else", () => {
  // The gate is added by repositories/hire.ts on the way out, so a caller cannot
  // forget it and a second `user:` key cannot overwrite it. This clause must
  // therefore carry no visibility of its own — if it grows one, there are two
  // gates again and one of them will drift.
  const w = memberEligibilityWhere(["cohort_1"]) as Record<string, unknown>;
  assert(!("user" in w), "the pool clause must not build a user gate");
  assert(
    !("recruiterVisibilityConsentAt" in w),
    "the old per-track consent clause must be gone",
  );
  assert("cohortId" in w && "status" in w, "it must still scope the pool");
});

suite("the seam adds the gate with AND, not a spreadable key", () => {
  const src = readFileSync(join(process.cwd(), "src/repositories/hire.ts"), "utf8");
  assert(
    src.includes("AND: [where, { user: searchableUserWhere() }]"),
    "listProgramCandidates must AND the gate onto whatever the caller passes",
  );
});

suite("/talent pool uses CandidateVisibility, not the legacy consent column", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/talent-pool/pool.ts"),
    "utf8",
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    !code.includes("recruiterVisibilityConsentAt"),
    "/talent must not use recruiterVisibilityConsentAt as visibility",
  );
  assert(
    code.includes("searchableUserWhere()"),
    "/talent must gate on searchableUserWhere",
  );
});

/* ── source scan ─────────────────────────────────────────────────────────── */

/**
 * Prisma models that 078 migrates and whose rows describe a PERSON. Reading one
 * of these directly from `src/features/hire/` bypasses the repository seam, so
 * the recruiter desk would not switch with the rest of the platform at Phase 6 —
 * and, more immediately, it is how an ungated candidate query gets written.
 *
 * Hire-owned tables (`TalentRequest`, `TalentRequestMatch`,
 * `TalentEngagementRequest`, ...) are deliberately absent: they have no
 * legacy/new duality, are not part of the migration, and wrapping them would buy
 * a layer and nothing else.
 */
const MIGRATED_CANDIDATE_MODELS = [
  "prisma.programMember.",
  "prisma.enrollment.",
  "prisma.hackathonParticipant.",
  "prisma.submission.",
  "prisma.quizAttempt.",
  "prisma.programMissionSubmission.",
  "prisma.programDay.",
  "prisma.programCohort.",
];

function scanFile(name: string, src: string): string[] {
  return MIGRATED_CANDIDATE_MODELS.filter((n) => src.includes(n)).map(
    (n) => `${name} reads ${n}* directly instead of via repositories/hire.ts`,
  );
}

suite("no hire file reads a migrated candidate table directly", () => {
  const dir = join(process.cwd(), "src/features/hire");
  const problems: string[] = [];
  let scanned = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    scanned++;
    problems.push(...scanFile(f, readFileSync(join(dir, f), "utf8")));
  }
  assert(scanned > 10, `expected to scan the hire feature, saw ${scanned} files`);
  assert(
    problems.length === 0,
    `reads outside the seam:\n      - ${problems.join("\n      - ")}`,
  );
});

suite("every candidate query in the seam applies the gate", () => {
  // The queries live in repositories/hire.ts now, so this is where the gate is
  // checked. A label lookup for a candidate already known from a stored match or
  // engagement is not a discovery query and is identified by `shortlistedBy`.
  const src = readFileSync(join(process.cwd(), "src/repositories/hire.ts"), "utf8");
  const problems: string[] = [];
  for (const needle of [
    "prisma.programMember.findMany",
    "prisma.enrollment.findMany",
    "prisma.hackathonParticipant.findMany",
  ]) {
    let from = 0;
    for (;;) {
      const at = src.indexOf(needle, from);
      if (at === -1) break;
      from = at + needle.length;
      const window = src.slice(at, at + 900);
      if (window.includes("searchableUserWhere()")) continue;
      if (window.includes("shortlistedBy")) continue;
      problems.push(`${needle} at offset ${at} is missing the gate`);
    }
  }
  assert(
    problems.length === 0,
    `ungated in the seam:\n      - ${problems.join("\n      - ")}`,
  );
});

suite("the saved match list re-applies the gate on read", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/hire/load-request-matches.ts"),
    "utf8",
  );
  assert(
    src.includes("filterSearchableUserIds("),
    "loadRequestMatches must re-filter stored matches",
  );
  assert(
    !/matches:\s*request\.matches\.map/.test(src),
    "the rendered list must be the filtered one, not the raw stored rows",
  );
});

suite("no hire file builds its own visibility clause", () => {
  const dir = join(process.cwd(), "src/features/hire");
  const offenders: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = readFileSync(join(dir, f), "utf8");
    // Comments may name these; code may not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    if (
      code.includes("recruiterVisibilityConsentAt") ||
      code.includes("searchableByRecruiters")
    ) {
      offenders.push(f);
    }
  }
  assert(
    offenders.length === 0,
    `these build their own gate instead of importing it: ${offenders.join(", ")}`,
  );
});

/* ─── Plan 117: discoverability from profile state alone ─────────────────── */

const hireSrc = (f: string) =>
  readFileSync(join(process.cwd(), "src/features/hire", f), "utf8");
const repoSrc = (f: string) =>
  readFileSync(join(process.cwd(), "src/repositories", f), "utf8");

/** Comments may name a forbidden field; code may not. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

suite("a usable profile is enough to be searchable", () => {
  const src = repoSrc("hire.ts");
  const i = src.indexOf("export async function listProfileCandidates");
  assert(i !== -1, "the profile pool query exists");
  const fn = src.slice(i, i + 900);

  // The shared gate, not a hand-rolled copy.
  assert(fn.includes("searchableUserWhere()"), "uses the one discovery gate");
  // Usable = at least one hand-claimed skill + a real name.
  assert(
    fn.includes("claimedByCandidate: true"),
    "requires a skill the candidate claimed",
  );
  assert(fn.includes('fullName: { not: "" }'), "requires a name");

  // And nothing else. No toggle, no evidence, no ABTalks activity.
  for (const forbidden of [
    "openToWork",
    "enrollment",
    "programMember",
    "hackathonParticipant",
    "missionsPassed",
    "clearsEvidenceFloor",
  ]) {
    assert(!fn.includes(forbidden), `eligibility must not depend on ${forbidden}`);
  }
});

suite("the PROFILE track is registered and carries no evidence bar", () => {
  const track = findTrack("PROFILE");
  assert(track !== null, "PROFILE is a known track");
  assert(
    track?.supportsEvidenceDays === false,
    "a day floor on a profile is meaningless and would empty the result",
  );
  assert(
    (track?.dedupePriority ?? 99) < 30,
    "real evidence must win the card over a bare profile",
  );

  const loader = hireSrc("track-loaders.ts");
  const i = loader.indexOf("async function loadProfile");
  assert(i !== -1, "loadProfile exists");
  const fn = loader.slice(i, loader.indexOf("export async function loadTrack"));
  assert(
    !fn.includes("clearsEvidenceFloor"),
    "the profile track must never consult the evidence floor",
  );
  assert(fn.includes("belowEvidenceFloor: 0"), "no floor is reported");
});

suite("REGRESSION: a zero-evidence candidate is not filtered out", () => {
  // Exactly what the PROFILE loader produces: no missions, no passes, no
  // commits, no interview. Evidence may rank; it must never exclude.
  const member = {
    id: "u1",
    source: "PROFILE",
    candidateRef: "PROFILE:u1",
    userId: "u1",
    fullName: "Fresh Candidate",
    jobRole: "Candidate",
    company: "",
    yearsExperience: 0,
    skills: ["React", "TypeScript"],
    missionPoints: 0,
    missionsPassed: 0,
    missionsAttempted: 0,
    missionsWaived: 0,
    cleanPassCount: 0,
    totalScore: 0,
    commitDayCount: 0,
    projectScores: [],
    interview: null,
    hasVisibilityConsent: true,
    cohortPublished: true,
    status: "ENROLLED",
    availability: null,
  } as unknown as ScoreableMember;

  const spec = { mustHaveStack: ["React"] } as unknown as JobSpec;
  const result = evaluateHardFilters(member, spec);
  assert(
    result.ok,
    `zero-evidence candidate excluded: ${result.reasons.join(", ")}`,
  );
  assert(
    !result.reasons.some((r) => /mission|evidence|floor/i.test(r)),
    `no evidence-shaped exclusion: ${result.reasons.join(", ")}`,
  );
});

/* ─── Plan 117: opportunity types as a recruiter filter ──────────────────── */

function memberWithTypes(types: string[]): ScoreableMember {
  return {
    id: "u2",
    userId: "u2",
    fullName: "T",
    jobRole: "Dev",
    company: "",
    yearsExperience: 1,
    skills: ["React"],
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
    availability: {
      openToWork: true,
      expectedSalaryMin: null,
      expectedSalaryMax: null,
      salaryCurrency: "INR",
      noticePeriodDays: null,
      preferredWorkMode: null,
      preferredCities: [],
      openToRelocate: false,
      opportunityTypes: types,
    },
  } as unknown as ScoreableMember;
}

const engagementSpec = (t: string) => ({ employmentType: t }) as unknown as JobSpec;

suite("engagement type filters on ANY overlap", () => {
  const both = memberWithTypes(["INTERNSHIP", "FREELANCE"]);
  assert(
    evaluateHardFilters(both, engagementSpec("FREELANCE")).ok,
    "a stated overlap must pass",
  );
  const miss = evaluateHardFilters(both, engagementSpec("FULL_TIME"));
  assert(!miss.ok, "a stated list that omits the type must be excluded");
  assert(
    miss.reasons.some((r) => /engagement/i.test(r)),
    `reason names the engagement type: ${miss.reasons.join(", ")}`,
  );
});

suite("an unstated list never excludes", () => {
  const silent = memberWithTypes([]);
  for (const t of [
    "FULL_TIME",
    "INTERNSHIP",
    "PART_TIME",
    "CONTRACT",
    "FREELANCE",
  ]) {
    assert(
      evaluateHardFilters(silent, engagementSpec(t)).ok,
      `empty opportunityTypes must not exclude for ${t}`,
    );
  }
});

suite("all five engagement types are speakable by a recruiter", () => {
  const convo = hireSrc("scout-conversation.ts");
  const schema = readFileSync(
    join(process.cwd(), "src/lib/validations/hire.ts"),
    "utf8",
  );
  for (const t of [
    "FULL_TIME",
    "CONTRACT",
    "INTERNSHIP",
    "PART_TIME",
    "FREELANCE",
  ]) {
    assert(schema.includes(`"${t}"`), `${t} is accepted by the spec schema`);
    assert(convo.includes(t), `${t} is parseable from a recruiter message`);
  }
});

suite("the candidate side offers all five opportunity types", () => {
  const schema = readFileSync(
    join(process.cwd(), "src/lib/validations/candidate-profile.ts"),
    "utf8",
  );
  assert(
    schema.includes("opportunityTypes: z.array(z.enum(OpportunityType))"),
    "the profile accepts the whole enum rather than a hand-listed subset",
  );
  const repo = repoSrc("candidate.ts");
  assert(
    repo.includes("opportunityTypes: true"),
    "availability actually reads the column — this was the whole Task 2 gap",
  );
});

/* ─── Plan 117: payload audit ────────────────────────────────────────────── */

suite("no contact field can reach the browser payload", () => {
  const code = stripComments(hireSrc("to-public-match.ts"));
  for (const forbidden of [
    "phone",
    "email",
    "resumeUrl",
    "linkedinUrl",
    "githubUsername",
    "expectedSalary",
  ]) {
    assert(!code.includes(forbidden), `toPublicMatch must never carry ${forbidden}`);
  }
  // Links are booleans, and that is the whole contract.
  assert(
    code.includes("githubConnected") && code.includes("linkedinConnected"),
    "links stay booleans on the card",
  );
});

suite("dossiers carry link booleans, never addresses", () => {
  for (const f of [
    "profile-dossier.ts",
    "hackathon-dossier.ts",
    "challenge-dossier.ts",
  ]) {
    const code = stripComments(hireSrc(f));
    for (const forbidden of [
      "linkedinUrl",
      "githubUsername",
      "resumeUrl",
      "phone",
    ]) {
      assert(!code.includes(forbidden), `${f} must not read ${forbidden}`);
    }
  }
});

/* ─── Plan 133: no candidate-controlled visibility ───────────────────────── */

const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, "/");

/** Every non-test TS source the app, its seeds and its scripts can run. */
function walkSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Historical migration SQL is never edited; node_modules is not ours.
      if (entry.name === "node_modules" || entry.name === "migrations") continue;
      walkSources(p, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const ALL_SOURCES = ["src", "scripts", "prisma"].flatMap((d) =>
  walkSources(join(process.cwd(), d)),
);

suite("what a recruiter sees is one platform constant, equal to the old defaults", () => {
  // The eight `show*` columns had no candidate writer, so every live row held
  // these exact values. If this ever differs, the swap stopped being a no-op.
  const expected: Record<string, boolean> = {
    linkedin: true,
    github: true,
    resume: false,
    interviewResults: false,
    assessmentScores: false,
    currentEmployer: true,
  };
  const policy = RECRUITER_FIELD_POLICY as Record<string, boolean>;
  for (const [k, v] of Object.entries(expected)) {
    assert(policy[k] === v, `RECRUITER_FIELD_POLICY.${k} must be ${v}`);
  }
  assert(
    Object.keys(policy).length === Object.keys(expected).length,
    "the policy must not grow fields without this test changing",
  );
  assert(Object.isFrozen(RECRUITER_FIELD_POLICY), "the policy is frozen at runtime");
  assert(
    !("email" in policy) && !("phone" in policy),
    "email and phone are released only by contact-access, never by a field policy",
  );
});

suite("no code reads or writes a per-candidate show* column", () => {
  assert(
    ALL_SOURCES.length > 300,
    `expected to scan the whole codebase, saw ${ALL_SOURCES.length} files`,
  );
  const offenders = ALL_SOURCES.filter((p) =>
    /\bshow(Email|Phone|Resume|Linkedin|Github|AssessmentScores|InterviewResults|CurrentEmployer)\b/.test(
      stripComments(readFileSync(p, "utf8")),
    ),
  ).map(rel);
  assert(
    offenders.length === 0,
    `per-candidate field visibility is back in: ${offenders.join(", ")}`,
  );
});

suite("the search gate is the discovery gate and nothing a candidate sets", () => {
  const talent = stripComments(repoSrc("talent.ts"));
  const i = talent.indexOf("function buildUserGate");
  assert(i !== -1, "buildUserGate exists");
  const fn = talent.slice(i, talent.indexOf("function preferenceFilter"));
  assert(
    fn.includes("...searchableUserWhere()"),
    "the search gate must reuse the one discovery gate, not restate it",
  );
  assert(
    !/show[A-Z]|minAssessmentScore|assessmentReports/.test(fn),
    "no field-visibility or hidden-score clause may reach the search gate",
  );
  assert(
    !stripComments(repoSrc("types.ts")).includes("minAssessmentScore"),
    "filtering on a score the platform hides would let a recruiter infer it",
  );
  assert(
    !talent.includes("visibleProgramMemberWhere"),
    "the legacy consent fragment is gone",
  );
});

suite("only platform and admin code writes CandidateVisibility", () => {
  // Seeds and one-off scripts are not candidate-callable; the app is what counts.
  const writers = ALL_SOURCES.map(rel).filter(
    (p) =>
      p.startsWith("src/") &&
      /candidateVisibility\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(
        stripComments(readFileSync(join(process.cwd(), p), "utf8")),
      ),
  );
  const allowed = new Set([
    "src/repositories/dual-write.ts",
    "src/features/admin/anonymize-user.ts",
  ]);
  const unexpected = writers.filter((p) => !allowed.has(p));
  assert(
    unexpected.length === 0,
    `CandidateVisibility is written outside platform/admin code: ${unexpected.join(", ")}`,
  );
  const actions = readdirSync(join(process.cwd(), "src/app/actions"))
    .filter((f) => f.endsWith(".ts"))
    .filter((f) =>
      stripComments(
        readFileSync(join(process.cwd(), "src/app/actions", f), "utf8"),
      ).includes("recruiterVisibilityConsentAt"),
    );
  assert(
    actions.length === 0,
    `a server action writes the old consent column: ${actions.join(", ")}`,
  );
});

suite("no candidate surface asks for or accepts a visibility choice", () => {
  const read = (p: string) =>
    stripComments(readFileSync(join(process.cwd(), p), "utf8"));
  assert(
    !read("src/components/program/apply-form.tsx").includes("recruiterVisibility"),
    "the apply form has no recruiter opt-in",
  );
  assert(
    !read("src/lib/validations/program.ts").includes("recruiterVisibilityConsent"),
    "the apply schema has no recruiter-visibility field",
  );
  assert(
    !read("src/features/program/entry.ts").includes("recruiterVisibilityConsentAt"),
    "applying stamps no consent that was never asked for",
  );
  const talentActions = read("src/app/actions/talent-actions.ts");
  assert(
    !talentActions.includes("setRecruiterVisibilityAction") &&
      !talentActions.includes("candidateVisibility"),
    "no candidate-callable visibility action exists",
  );

  // A stale client still posting the old field is accepted, and the field is
  // dropped before anything downstream can see it.
  const parsed = applyProfileSchema.safeParse({
    skills: ["React"],
    linkedinUrl: "https://linkedin.com/in/someone",
    githubUsername: "someone",
    githubRepoUrl: "https://github.com/someone/ai-cohort",
    hasLaptop8Gb: true,
    recruiterVisibilityConsent: false,
  });
  assert(parsed.success, "an old client posting the removed field still applies");
  assert(
    parsed.success && !("recruiterVisibilityConsent" in parsed.data),
    "the removed field is stripped, not passed through",
  );
});

suite("moderation stays admin-only, server-side and durable", () => {
  const anonymize = stripComments(
    readFileSync(join(process.cwd(), "src/features/admin/anonymize-user.ts"), "utf8"),
  );
  assert(anonymize.includes("deletedAt: now"), "deletion stamps User.deletedAt");
  assert(
    anonymize.includes("searchableByRecruiters: false") &&
      anonymize.includes("withdrawnAt: now"),
    "deletion withdraws the candidate from discovery",
  );
  assert(anonymize.includes("adminAction.create"), "deletion is audited");

  // `withdrawnAt` is the hard stop: neither dual-write helper may reopen it.
  const dual = repoSrc("dual-write.ts");
  assert(
    dual.split("if (existing?.withdrawnAt) return;").length - 1 === 2,
    "both dual-write visibility helpers must stop on withdrawnAt",
  );

  // The only way in is an admin action behind requireAdmin().
  const callers = ALL_SOURCES.map(rel).filter(
    (p) =>
      p.startsWith("src/") &&
      p !== "src/features/admin/anonymize-user.ts" &&
      readFileSync(join(process.cwd(), p), "utf8").includes(
        "@/features/admin/anonymize-user",
      ),
  );
  assert(
    callers.length === 1 && callers[0] === "src/app/actions/admin-actions.ts",
    `anonymizeUser must be reachable only from admin actions, found: ${callers.join(", ")}`,
  );
  const admin = readFileSync(
    join(process.cwd(), "src/app/actions/admin-actions.ts"),
    "utf8",
  );
  const at = admin.indexOf("export async function deleteUserAccountAction");
  assert(at !== -1, "the admin delete action exists");
  const body = admin.slice(at, admin.indexOf("anonymizeUser(tx", at));
  assert(
    body.includes("await requireAdmin()"),
    "the admin delete action must call requireAdmin() before anonymizing",
  );
});


console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
