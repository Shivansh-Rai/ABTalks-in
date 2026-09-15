/**
 * T-270-minimum writeAudit.
 *   npm run test:audit
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("\nT-270 writeAudit");

const audit = read("src/features/admin/audit.ts");

suite("writeAudit is the only export and creates a row", () => {
  assert(audit.includes("export async function writeAudit"), "writeAudit export");
  assert(audit.includes("tx.adminAction.create"), "creates AdminAction");
  assert(!audit.includes("adminAction.update"), "no update");
  assert(!audit.includes("adminAction.delete"), "no delete");
  assert(
    (audit.match(/export async function/g) ?? []).length === 1,
    "only writeAudit",
  );
});

suite("writeAudit stores actor, entity, reason, before/after", () => {
  assert(audit.includes("actorUserId: input.actorUserId"), "actorUserId");
  assert(audit.includes("entityType: input.entityType"), "entityType");
  assert(audit.includes("entityId: input.entityId"), "entityId");
  assert(audit.includes("reason: input.reason"), "reason");
  assert(audit.includes("previousState:"), "previousState");
  assert(audit.includes("newState:"), "newState");
});

suite("callers pass reason, previousState, newState", () => {
  const ops = read("src/features/admin/account-ops.ts");
  const del = read("src/features/profile/delete-own-account.ts");
  const cfg = read("src/lib/platform-config.ts");
  for (const [name, src] of [
    ["account-ops", ops],
    ["delete-own-account", del],
    ["platform-config", cfg],
  ] as const) {
    assert(src.includes("writeAudit("), `${name} calls writeAudit`);
    assert(src.includes("previousState:"), `${name} previousState`);
    assert(src.includes("newState:"), `${name} newState`);
    assert(src.includes("reason:"), `${name} reason`);
  }
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
