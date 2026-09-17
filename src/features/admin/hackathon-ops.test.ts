/**
 * T-276 hackathon admin ops — shape guarantees.
 *
 *   npm run test:t276-hackathon-ops
 *
 * Source-scan style, same as T-268's delivery-diagnosis and the other
 * T-24x shape tests. Pins the class of bug:
 *
 * - Every new ops action is exported.
 * - Every action calls `requireAdmin()` (no client-supplied admin id).
 * - Every action Zod-parses input.
 * - Every action writes an `AdminAction` audit row inside a
 *   Prisma `$transaction`, and the delete/mutation happens INSIDE the
 *   same transaction — so a failed delete never lands without its
 *   audit, and an audit never lands without the mutation attempt.
 * - Every action revalidates `/admin/hackathon`.
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

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const actionSrc = read("src/app/actions/admin-hackathon-actions.ts");
const validationSrc = read("src/lib/validations/hackathon.ts");
const src = stripComments(actionSrc);

console.log("\nT-276 hackathon admin ops shape");

suite("both new actions are exported", () => {
  for (const name of [
    "disqualifyHackathonTeamAction",
    "resetHackathonTeamSubmissionAction",
  ]) {
    assert(
      new RegExp(`export\\s+async\\s+function\\s+${name}\\b`).test(src),
      `${name} must be exported from admin-hackathon-actions.ts`,
    );
  }
});

suite("Zod schemas for both actions are exported", () => {
  const v = stripComments(validationSrc);
  for (const name of ["disqualifyTeamSchema", "resetTeamSubmissionSchema"]) {
    assert(
      new RegExp(`export\\s+const\\s+${name}\\b`).test(v),
      `${name} must be exported from validations/hackathon.ts`,
    );
  }
});

suite("both actions gate on requireAdmin()", () => {
  const requireAdminCalls = src.match(/await\s+requireAdmin\s*\(\s*\)/g) ?? [];
  // 2 existing ops (updateProblemStatement, removeTeamMember) + 2 new = 4.
  assert(
    requireAdminCalls.length >= 4,
    `expected at least 4 requireAdmin() calls in the actions file, got ${requireAdminCalls.length}`,
  );
});

suite("both actions Zod-parse their input", () => {
  const parseCalls = src.match(/\.safeParse\(/g) ?? [];
  assert(
    parseCalls.length >= 4,
    `expected at least 4 Zod safeParse calls, got ${parseCalls.length}`,
  );
});

suite("audit row is written INSIDE the mutation transaction", () => {
  // For both actions the pattern must be: prisma.$transaction(async (tx) => {
  //   await tx.adminAction.create(...); await tx.hackathon<X>.<mutate>(...); });
  // A grep for adminAction.create sitting inside the same transaction as
  // the mutation is enough to catch the mistake where either half is
  // moved outside the transaction.
  for (const [action, mutation] of [
    ["disqualifyHackathonTeamAction", "hackathonTeam.delete"],
    ["resetHackathonTeamSubmissionAction", "hackathonSubmission.delete"],
  ]) {
    const bodyMatch = src.match(
      new RegExp(`function\\s+${action}[\\s\\S]*?\\n\\}`),
    );
    assert(bodyMatch !== null, `${action} body must be present`);
    const body = bodyMatch![0];
    assert(
      /prisma\.\$transaction\s*\(\s*async\s*\(\s*tx\s*\)/.test(body),
      `${action} must wrap the mutation in prisma.$transaction`,
    );
    assert(
      /tx\.adminAction\.create/.test(body),
      `${action} must write an AdminAction audit row`,
    );
    assert(
      new RegExp(`tx\\.${mutation}`).test(body),
      `${action} must call tx.${mutation} inside the same transaction`,
    );
    const adminIdx = body.indexOf("tx.adminAction.create");
    const mutIdx = body.indexOf(`tx.${mutation}`);
    assert(
      adminIdx >= 0 && mutIdx > adminIdx,
      `${action}: audit row must be written BEFORE the mutation (so an audit-less mutation cannot happen)`,
    );
  }
});

suite("both actions revalidate /admin/hackathon", () => {
  const revalidateCalls =
    src.match(/revalidatePath\(\s*["']\/admin\/hackathon["']/g) ?? [];
  // Existing 2 ops each revalidate, plus 2 new. Expect 4+.
  assert(
    revalidateCalls.length >= 4,
    `expected at least 4 revalidatePath("/admin/hackathon") calls, got ${revalidateCalls.length}`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
