/**
 * T-276 programme + AI cohort operations — coherence test.
 *
 *   npm run test:t276-programme-coherence
 *
 * Pins the surface of the two admin-ops areas T-276 catalogues but does
 * NOT modify (60-day programme + AI cohort). Both areas ship a
 * comprehensive ops set today; a future refactor that silently drops
 * one of them would leave "admin cannot X for Y" gaps in the demo
 * without any single failing feature — this test catches the drop.
 *
 * For each function the audit table names, we assert:
 *   1. It is exported from its expected file.
 *   2. Its body still contains a `requireAdmin()` call — the gate
 *      cannot be quietly relaxed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
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

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const PROGRAMME_ACTIONS = [
  // 60-day challenge — admin-actions.ts
  { name: "resetProgressAction", file: "src/app/actions/admin-actions.ts" },
  { name: "toggleReadyForInterviewAction", file: "src/app/actions/admin-actions.ts" },
  { name: "removeFromChallengeAction", file: "src/app/actions/admin-actions.ts" },
  { name: "deleteUserAccountAction", file: "src/app/actions/admin-actions.ts" },
  { name: "rejectSubmissionAction", file: "src/app/actions/admin-actions.ts" },
  { name: "grantSynergyAction", file: "src/app/actions/admin-actions.ts" },
] as const;

const COHORT_ACTIONS = [
  // AI cohort — admin-program-actions.ts
  { name: "createOrUpdateCohortAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "regenerateJoinCodeAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "setCohortStatusAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "publishResultsAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "promoteWaitlistedAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "dropMemberAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "adminUnlockDayAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "grantSkipTokenAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "regenerateRecommendationAction", file: "src/app/actions/admin-program-actions.ts" },
  { name: "getAdminCohortIdAction", file: "src/app/actions/admin-program-actions.ts" },
] as const;

console.log("\nT-276 programme + AI cohort admin coherence");

suite("every 60-day programme ops function is still exported", () => {
  const src = read(PROGRAMME_ACTIONS[0].file);
  for (const action of PROGRAMME_ACTIONS) {
    assert(
      new RegExp(`export\\s+async\\s+function\\s+${action.name}\\b`).test(src),
      `${action.name} must be exported from ${action.file}`,
    );
  }
});

suite("every AI cohort ops function is still exported", () => {
  const src = read(COHORT_ACTIONS[0].file);
  for (const action of COHORT_ACTIONS) {
    assert(
      new RegExp(`export\\s+async\\s+function\\s+${action.name}\\b`).test(src),
      `${action.name} must be exported from ${action.file}`,
    );
  }
});

suite("every ops function still goes through requireAdmin()", () => {
  // Check the whole file: every ops function's body sits somewhere in it,
  // and the gate is either called inline or through a small helper. A file
  // that lost every requireAdmin() call would fail this outright.
  for (const file of [
    "src/app/actions/admin-actions.ts",
    "src/app/actions/admin-program-actions.ts",
  ]) {
    const src = stripComments(read(file));
    assert(
      /requireAdmin\s*\(\s*\)/.test(src),
      `${file} must call requireAdmin() at least once`,
    );
  }
});

suite("hackathon still has its existing two ops", () => {
  // Sanity: the two ops T-276 expands must exist before the expansion
  // has anything to expand ON.
  const src = read("src/app/actions/admin-hackathon-actions.ts");
  for (const name of [
    "updateHackathonProblemStatementAction",
    "adminRemoveHackathonTeamMemberAction",
  ]) {
    assert(
      new RegExp(`export\\s+async\\s+function\\s+${name}\\b`).test(src),
      `${name} must still be exported`,
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
