/**
 * T-217 candidate self-delete.
 *   npm run test:self-delete
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

console.log("\nT-217 self-delete");

const src = read("src/features/profile/delete-own-account.ts");

suite("hard-deletes the user and does not anonymize", () => {
  assert(src.includes("tx.user.delete"), "tx.user.delete");
  assert(!src.includes("anonymizeUser"), "no anonymizeUser");
  assert(
    src.includes("candidateUserId: null"),
    "nulls CreditTransaction.candidateUserId",
  );
});

suite("audits with email domain, never the password value", () => {
  assert(src.includes("writeAudit("), "writeAudit");
  assert(src.includes("emailDomain"), "emailDomain snapshot");
  assert(src.includes("hadPassword: Boolean(user.password)"), "hadPassword flag");
  assert(src.includes('actionType: "ACCOUNT_SELF_DELETE"'), "action type");
  assert(
    !src.includes("previousState: { password"),
    "does not store password",
  );
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
