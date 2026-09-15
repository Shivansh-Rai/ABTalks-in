/**
 * T-272 disable / restore / secure.
 *   npm run test:account-ops
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isJwtInvalidated } from "@/lib/account-status";

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

console.log("\nT-272 account ops");

suite("isJwtInvalidated compares iat to sessionInvalidatedAt", () => {
  const invalidatedAt = new Date(100 * 1000);
  assert(
    isJwtInvalidated(100, invalidatedAt) === false,
    "equal iat is still valid",
  );
  assert(
    isJwtInvalidated(99, invalidatedAt) === true,
    "older iat is invalid",
  );
});

const ops = read("src/features/admin/account-ops.ts");
const actions = read("src/app/actions/admin-account-actions.ts");
const dialog = read("src/components/admin/account-ops-dialog.tsx");
const panel = read("src/components/admin/student-action-panel.tsx");
const recruiters = read("src/components/talent/admin-recruiters-panel.tsx");
const auth = read("src/auth.ts");
const talent = read("src/repositories/talent.ts");

suite("disable/restore/secure call writeAudit with reason and before/after", () => {
  assert(ops.includes('actionType: "ACCOUNT_DISABLE"'), "disable");
  assert(ops.includes('actionType: "ACCOUNT_RESTORE"'), "restore");
  assert(ops.includes('actionType: "ACCOUNT_SECURE"'), "secure");
  assert(ops.includes("writeAudit("), "writeAudit");
  assert(ops.includes("previousState:"), "previousState");
  assert(ops.includes("newState:"), "newState");
  assert(ops.includes("reason: input.reason"), "reason");
});

suite("account-ops screens never mention password", () => {
  for (const [name, src] of [
    ["account-ops.ts", ops],
    ["admin-account-actions.ts", actions],
    ["account-ops-dialog.tsx", dialog],
    ["student-action-panel.tsx", panel],
    ["admin-recruiters-panel.tsx", recruiters],
  ] as const) {
    assert(!src.includes("type=\"password\""), `${name} no password input`);
    assert(!src.includes("name=\"password\""), `${name} no password field`);
  }
  assert(!/\bpassword\b/.test(ops), "account-ops.ts no password key");
  assert(!/\bpassword\b/.test(actions), "admin-account-actions.ts no password key");
});

suite("searchableUserWhere hides disabled accounts", () => {
  assert(talent.includes("disabledAt: null"), "disabledAt gate");
});

suite("auth.ts session callback reads disabledAt and sessionInvalidatedAt", () => {
  assert(auth.includes("disabledAt: true"), "selects disabledAt");
  assert(auth.includes("sessionInvalidatedAt: true"), "selects sessionInvalidatedAt");
  assert(auth.includes("isJwtInvalidated"), "uses isJwtInvalidated");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
