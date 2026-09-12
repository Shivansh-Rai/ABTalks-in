/**
 * Demo 1 isolation + authorization source scans.
 *   npm run test:demo1-security
 */
import { readFileSync, readdirSync } from "node:fs";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function actionFiles(): string[] {
  const dir = join(process.cwd(), "src/app/actions");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/app/actions/${f}`);
}

console.log("\nDemo 1 isolation + authorization");

suite("hire request page scopes TalentRequest by recruiterUserId", () => {
  const src = read("src/app/hire/[requestId]/page.tsx");
  assert(
    src.includes("recruiterUserId: userId") ||
      src.includes("recruiterUserId: userId"),
    "request page must bind recruiterUserId",
  );
  assert(src.includes("requireRecruiter"), "request page must require a recruiter");
});

suite("hire actions look up requests with recruiterUserId in the where", () => {
  const src = read("src/app/actions/hire-actions.ts");
  assert(
    src.includes("recruiterUserId: userId") ||
      src.includes("recruiterUserId: gate.data.userId"),
    "hire-actions must own TalentRequest rows",
  );
  assert(
    src.includes("requireApprovedRecruiterAction") ||
      src.includes("requireApprovedRecruiter"),
    "hire mutations must use the recruiter gate",
  );
});

suite("engagement comments refuse another recruiter's id", () => {
  const src = read("src/app/actions/hire-request-actions.ts");
  assert(
    src.includes("recruiterUserId: gate.data.userId"),
    "addEngagementCommentAction must scope by recruiterUserId",
  );
});

suite("evidence page requires an approved recruiter, not just a session", () => {
  const src = read("src/app/hire/evidence/page.tsx");
  assert(src.includes("requireRecruiter"), "/hire/evidence must call requireRecruiter");
});

suite("every admin-*.ts action file calls requireAdmin", () => {
  const files = actionFiles().filter((f) =>
    f.startsWith("src/app/actions/admin-"),
  );
  assert(files.length > 5, "expected several admin action files");
  for (const f of files) {
    const src = read(f);
    assert(
      src.includes("requireAdmin"),
      `${f} must call requireAdmin`,
    );
  }
});

suite("candidate applyToJobAction does not require a recruiter", () => {
  const src = read("src/app/actions/job-actions.ts");
  assert(
    !src.includes("requireApprovedRecruiter"),
    "candidates must still apply without a recruiter gate",
  );
  assert(src.includes("auth()"), "apply still requires a session");
});

suite("saveCandidateAvailabilityAction is the candidate's own userId", () => {
  const src = read("src/app/actions/hire-actions.ts");
  assert(
    src.includes("upsertCandidateAvailability(session.user.id"),
    "availability writes the session user, not a recruiter id",
  );
});

suite("recruiter assessment actions go through the workspace gate", () => {
  const src = read("src/app/actions/recruiter-assessment-actions.ts");
  assert(
    src.includes("requireRecruiterWorkspace"),
    "assessment actions must call requireRecruiterWorkspace",
  );
  // T-244: publish and assign are gated like save and delete.
  assert(
    src.includes("publishRecruiterAssessmentAction") &&
      src.includes("assignRecruiterAssessmentAction"),
    "publish and assign actions must exist",
  );
  const gateCalls = src.split("requireRecruiterWorkspace()").length - 1;
  assert(
    gateCalls >= 4,
    `every assessment action must call requireRecruiterWorkspace() (found ${gateCalls}, need 4)`,
  );
  assert(
    !/createdByUserId:\s*session\.user\.id/.test(src) &&
      !/organizationId:\s*session\.user\.id/.test(src),
    "must not use session.user.id as a scope value",
  );
});

suite("assessment detail page 404s a foreign id", () => {
  const src = read("src/app/hire/assessments/[assessmentId]/page.tsx");
  assert(
    src.includes("requireRecruiterWorkspace"),
    "detail page must scope its read through requireRecruiterWorkspace",
  );
  assert(src.includes("notFound()"), "a foreign or unknown id must be notFound()");
  assert(
    !src.includes("searchParams"),
    "detail page must not take candidate or scope data from the query string",
  );
});

// T-218 (plan 129): the candidate side of assessments.
suite("candidate assessment page 404s a foreign assignment", () => {
  const page = read("src/app/assessments/[assignmentId]/page.tsx");
  assert(page.includes("auth()"), "the attempt page must resolve the session");
  assert(page.includes("notFound()"), "a foreign or unknown assignment must be notFound()");
  for (const word of ["searchParams", "isCorrect", "scorePercent"]) {
    assert(!page.includes(word), `the attempt page must not contain ${word}`);
  }
  const list = read("src/app/assessments/page.tsx");
  assert(list.includes("auth()"), "the list page must resolve the session");
  assert(
    !list.includes("scorePercent") && !/\bpassed\b/.test(list),
    "the candidate list must not show a score (D-1)",
  );
});

suite("middleware protects /assessments and stays edge-safe", () => {
  const src = read("middleware.ts");
  assert(src.includes('"/assessments"'), "/assessments must be in protectedPaths");
  assert(!src.includes('from "@/lib'), "middleware must not import @/lib/*");
});

suite("talent project mutations scope rows to the caller", () => {
  const src = read("src/app/actions/talent-project-actions.ts");
  assert(
    src.includes("recruiterUserId: gate.data.userId"),
    "project writes must bind recruiterUserId from the session gate",
  );
  assert(
    src.includes("request: { recruiterUserId: gate.data.userId }"),
    "pipeline decisions must nest the request owner in the where",
  );
});

suite("recruiter job actions resolve the caller from the workspace", () => {
  const src = read("src/app/actions/recruiter-job-actions.ts");
  const gateCalls = src.split("requireRecruiterWorkspace()").length - 1;
  assert(
    gateCalls >= 4,
    `every job action must call requireRecruiterWorkspace() (found ${gateCalls}, need 4)`,
  );
  assert(
    src.includes("getMyJobAction") &&
      src.includes("listMyJobsAction") &&
      src.includes("listMyJobApplicantsAction") &&
      src.includes("getMyJobApplicantCardAction"),
    "workspace-scoped job reads (including applicants and inspector cards) must exist",
  );
  assert(
    !/recruiterId:\s*input/.test(src) && !/recruiterId:\s*parsed/.test(src),
    "the client must not supply the job owner id",
  );
});

suite("recruiter job applicant reads never select protected contact", () => {
  const store = read("src/features/recruiter-jobs/prisma-store.ts");
  const action = read("src/app/actions/recruiter-job-actions.ts");
  const listFn = store.slice(store.indexOf("async listByJob"));
  assert(
    listFn.includes("fullName: true") &&
      !listFn.includes("email") &&
      !listFn.includes("phone") &&
      !listFn.includes("linkedinUrl") &&
      !listFn.includes("resumeUrl"),
    "listByJob select must be fullName only",
  );
  assert(
    action.includes("listMyJobApplicantsAction") &&
      action.includes("listApplicantsForOwnedJob") &&
      action.includes("getMyJobApplicantCardAction") &&
      action.includes("loadApplicantMatchForOwnedJob"),
    "the applicants action must go through the owned-job service",
  );
  const card = read("src/features/recruiter-jobs/service.ts");
  const mapper = card.slice(card.indexOf("function toApplicantMatchCard"));
  assert(
    !mapper.includes("email") &&
      !mapper.includes("phone") &&
      !mapper.includes("linkedinUrl"),
    "the inspector card mapper must not assign contact fields",
  );
});

suite("credits and ledger take no organization id from the client", () => {
  const src = read("src/features/hire/credits.ts");
  assert(
    src.includes("requireRecruiterWorkspace()"),
    "credit reads must resolve the workspace from the session",
  );
  assert(
    src.includes("getCreditBalance(workspace.data.organizationId)"),
    "balance must use the session organization, not a payload id",
  );
  assert(
    src.includes("listCreditTransactions(workspace.data.organizationId"),
    "ledger must use the session organization, not a payload id",
  );
});

suite("unlock spend is workspace-scoped and rate-limited", () => {
  const action = read("src/app/actions/hire-unlock-actions.ts");
  assert(
    action.includes("requireRecruiterWorkspace()"),
    "unlockContactAction must resolve the caller before spending",
  );
  assert(
    action.includes('bucket: "UNLOCK"'),
    "unlockContactAction must call assertRateLimit UNLOCK",
  );
  const feature = read("src/features/hire/unlock-contact.ts");
  assert(
    feature.includes("requireRecruiterWorkspace()"),
    "the unlock feature must also resolve the workspace from the session",
  );
  assert(
    feature.includes("loadProtectedContact"),
    "reveal must go through loadProtectedContact",
  );
});

suite("outreach threads are owned by the sending recruiter", () => {
  const src = read("src/app/actions/outreach-actions.ts");
  assert(
    src.includes("requireRecruiterWorkspace()"),
    "recruiter outreach must use the workspace gate",
  );
  assert(
    src.includes("recruiterUserId: userId"),
    "thread lookup must include recruiterUserId",
  );
  assert(
    src.includes('bucket: "OUTREACH"'),
    "outreach must be rate-limited",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
