/**
 * T-264 admin candidate detail. Run with:
 *   npm run test:admin-candidate-detail
 *
 * No network, no database. Pins the privileged-read contract: page-level
 * requireAdmin, career view is a Server Component with no writers, assembler
 * fans out existing reads, assessment scores stay off this surface, and
 * soft-deleted users still render.
 */
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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const ASSEMBLER = "src/features/admin/get-admin-candidate-detail.ts";
const CAREER = "src/components/admin/candidate-career-sections.tsx";
const PAGE = "src/app/admin/students/[id]/page.tsx";
const OPS = "src/features/admin/get-student-detail.ts";

console.log("\nT-264 admin candidate detail\n");

suite("detail page calls requireAdmin", () => {
  assert(code(PAGE).includes("requireAdmin"), "page must call requireAdmin");
});

suite("career component is a Server Component with no actions", () => {
  const src = code(CAREER);
  assert(!src.includes('"use client"'), "career view must not be a client component");
  assert(
    !src.includes("@/app/actions"),
    "career view must not import @/app/actions — hiding a button is not security",
  );
});

suite("assembler calls the existing read helpers", () => {
  const src = code(ASSEMBLER);
  for (const helper of [
    "getCandidateDetail",
    "getProfileEvidence",
    "getVerifiedSkills",
    "getResumeView",
    "getVerifiedAccomplishments",
    "getHistory",
    "listMyApplications",
    "listCandidateAttempts",
    "listChallengeEnrollments",
    "searchDeliveries",
    "getStudentDetail",
  ]) {
    assert(src.includes(helper), `assembler must call ${helper}`);
  }
});

suite("career view has Self-declared and Evidence-backed labels", () => {
  const src = code(CAREER);
  assert(src.includes("Self-declared"), "must label Self-declared skills");
  assert(src.includes("Evidence-backed"), "must label Evidence-backed skills");
});

suite("career view does not show assessment scores", () => {
  const src = code(CAREER);
  assert(!src.includes("scorePercent"), "T-264 must not show scorePercent (T-273)");
  assert(!/\bpassed\b/.test(src), "T-264 must not show pass/fail (T-273)");
});

suite("soft-deleted users are not 404'd", () => {
  const ops = code(OPS);
  assert(
    !ops.includes("if (!user || user.deletedAt)"),
    "getStudentDetail must not 404 on deletedAt",
  );
  assert(
    !/if\s*\(\s*!user\s*\|\|\s*user\.deletedAt/.test(ops),
    "getStudentDetail must not combine missing-user and deletedAt",
  );
  const assembler = code(ASSEMBLER);
  assert(
    !assembler.includes("if (!user || user.deletedAt)"),
    "assembler must not 404 on deletedAt",
  );
  assert(assembler.includes("deletedAt"), "assembler must expose deletedAt");
});

suite("page mounts career sections and Profile/Diagnosis switch", () => {
  const src = code(PAGE);
  assert(src.includes("CandidateCareerSections"), "page must render career sections");
  assert(src.includes("getAdminCandidateDetail"), "page must load the assembler");
  assert(src.includes("CandidateDetailViewSwitch"), "page must mount the view switch");
  assert(src.includes("CandidateAdminActionsMenu"), "page must mount the actions menu");
  assert(!src.includes("StudentActionPanel"), "header button cluster is replaced");
});

const SWITCH = "src/components/admin/candidate-detail-view-switch.tsx";
const MENU = "src/components/admin/candidate-admin-actions-menu.tsx";

suite("view switch defaults to Profile and labels Diagnosis", () => {
  const src = code(SWITCH);
  assert(src.includes('"profile"'), "default view is profile");
  assert(src.includes("Profile"), "toggle shows Profile");
  assert(src.includes("Diagnosis"), "toggle shows Diagnosis");
});

suite("actions menu confirms before running", () => {
  const src = code(MENU);
  assert(src.includes("Perform admin action"), "dropdown trigger copy");
  assert(
    src.includes("Are you sure you want to perform this"),
    "every action must ask for confirmation",
  );
  assert(src.includes("disableAccountAction"), "disable stays wired");
  assert(src.includes('confirm: deleteConfirm'), "delete still requires typing delete");
  assert(src.includes("reason.trim().length >= 8"), "account ops still require a reason");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
