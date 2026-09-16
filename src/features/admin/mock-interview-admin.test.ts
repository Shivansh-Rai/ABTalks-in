/**
 * T-276 mock-interview admin — shape guarantees.
 *
 *   npm run test:t276-mock-interview
 *
 * Source-scan in the same spirit as T-268 delivery-diagnosis and T-247's
 * convergence tests. Pins the class of bug:
 *
 * - The repository is server-only and exposes the five ops the plan lists.
 * - Every ops mutation writes an AdminAction row inside its Prisma
 *   $transaction (audit first, mutation second — enforced by ordering).
 * - The action layer routes every call through `requireAdmin()` and Zod.
 * - The grant-allowance action honours the NOT_IMPLEMENTED code path so
 *   the UI can surface an intent without a persistent grant that the
 *   runtime cannot honour.
 * - No file outside src/features/admin/mock-interview-admin.ts touches
 *   `prisma.mockInterview.(delete|update|create)` — the "sole reader/
 *   writer" rule from T-240 is applied to the mock-interview admin
 *   surface too.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

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

function readOr(path: string): string | null {
  try {
    return readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return null;
  }
}

function walk(dir: string, out: string[]): void {
  const abs = join(process.cwd(), dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(abs, name);
    const rel = join(dir, name).replace(/\\/g, "/");
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(rel, out);
    else if (extname(name) === ".ts" || extname(name) === ".tsx") out.push(rel);
  }
}

const repo = readOr("src/features/admin/mock-interview-admin.ts");
const action = readOr("src/app/actions/admin-mock-interview-actions.ts");
const validation = readOr("src/lib/validations/mock-interview-admin.ts");
const listPage = readOr("src/app/admin/mock-interview/page.tsx");
const detailPage = readOr("src/app/admin/mock-interview/[id]/page.tsx");

console.log("\nT-276 mock-interview admin shape");

suite("repository is server-only and exports the five ops", () => {
  assert(repo !== null, "repository file must exist");
  const code = stripComments(repo ?? "");
  assert(
    /import\s+"server-only"/.test(code),
    "repository must import \"server-only\"",
  );
  for (const fn of [
    "listMockInterviews",
    "getMockInterviewDetail",
    "invalidateMockInterview",
    "deleteMockInterview",
    "grantMockInterviewAllowance",
  ]) {
    assert(
      new RegExp(`export async function ${fn}`).test(code),
      `repository must export ${fn}`,
    );
  }
});

suite("validations expose the five Zod schemas", () => {
  const code = stripComments(validation ?? "");
  for (const name of [
    "mockInterviewListFilterSchema",
    "mockInterviewIdSchema",
    "invalidateMockInterviewSchema",
    "deleteMockInterviewSchema",
    "grantMockAllowanceSchema",
  ]) {
    assert(
      new RegExp(`export const ${name}`).test(code),
      `validations file must export ${name}`,
    );
  }
});

suite("invalidate writes AdminAction BEFORE the mockInterview.update", () => {
  const code = stripComments(repo ?? "");
  const body = code.match(/function invalidateMockInterview[\s\S]*?\n\}/);
  assert(body !== null, "invalidateMockInterview body must exist");
  const b = body![0];
  assert(
    /prisma\.\$transaction/.test(b),
    "invalidate must wrap the flip in prisma.$transaction",
  );
  const adminIdx = b.indexOf("tx.adminAction.create");
  const updateIdx = b.indexOf("tx.mockInterview.update");
  assert(
    adminIdx > 0 && updateIdx > adminIdx,
    "audit row must be written BEFORE the mockInterview.update",
  );
});

suite("delete writes AdminAction BEFORE the mockInterview.delete", () => {
  const code = stripComments(repo ?? "");
  const body = code.match(/function deleteMockInterview[\s\S]*?\n\}/);
  assert(body !== null, "deleteMockInterview body must exist");
  const b = body![0];
  assert(
    /prisma\.\$transaction/.test(b),
    "delete must wrap the mutation in prisma.$transaction",
  );
  const adminIdx = b.indexOf("tx.adminAction.create");
  const deleteIdx = b.indexOf("tx.mockInterview.delete");
  assert(
    adminIdx > 0 && deleteIdx > adminIdx,
    "audit row must be written BEFORE the mockInterview.delete",
  );
});

suite("grant-allowance returns NOT_IMPLEMENTED until the model lands", () => {
  const code = stripComments(repo ?? "");
  assert(
    /code:\s*"NOT_IMPLEMENTED"/.test(code),
    "grant-allowance must return code: NOT_IMPLEMENTED so the UI can surface intent honestly",
  );
});

suite("every server action gates on requireAdmin + Zod", () => {
  const code = stripComments(action ?? "");
  const requireAdminCalls = code.match(/await\s+requireAdmin\s*\(\s*\)/g) ?? [];
  assert(
    requireAdminCalls.length >= 3,
    `expected requireAdmin() in every action; found ${requireAdminCalls.length}`,
  );
  const safeParses = code.match(/\.safeParse\(/g) ?? [];
  assert(
    safeParses.length >= 3,
    `expected safeParse in every action; found ${safeParses.length}`,
  );
});

suite("admin pages gate on requireAdmin() (list + detail)", () => {
  for (const [name, page] of [
    ["list", listPage],
    ["detail", detailPage],
  ] as const) {
    const code = stripComments(page ?? "");
    assert(
      /await\s+requireAdmin\s*\(\s*\)/.test(code),
      `${name} page must call requireAdmin() before reading data`,
    );
  }
});

suite("no code outside the repository writes to prisma.mockInterview.*", () => {
  const files: string[] = [];
  walk("src", files);
  const allowed = new Set([
    "src/features/admin/mock-interview-admin.ts",
    "src/features/admin/mock-interview-admin.test.ts",
  ]);
  // Runtime paths in src/features/interview/ read/write MockInterview
  // for legitimate reasons; explicitly allow them.
  const runtimeAllowed = /^src\/features\/interview\//;
  const violations: string[] = [];
  for (const file of files) {
    if (allowed.has(file)) continue;
    if (runtimeAllowed.test(file)) continue;
    const body = stripComments(readOr(file) ?? "");
    if (/prisma\.mockInterview\.(delete|update|create)/.test(body)) {
      violations.push(file);
    }
  }
  assert(
    violations.length === 0,
    `mockInterview mutations outside the T-276 repo (and interview runtime): ${violations.join(", ")}`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
