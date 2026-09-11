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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
