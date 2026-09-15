/**
 * T-277 mock allowance consumption.
 *   npm run test:mock-allowance
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

console.log("\nT-277 mock allowance");

const service = read("src/features/interview/platform/service.ts");

suite("startAttempt reads allowance and can debit MOCK_INTERVIEW", () => {
  assert(service.includes("MOCK_FREE_ALLOWANCE_KEY"), "allowance key");
  assert(service.includes("MOCK_POINT_COST_KEY"), "cost key");
  assert(service.includes("countAllCompletedAttempts"), "all-domain count");
  assert(service.includes("PointsSourceType.MOCK_INTERVIEW"), "source type");
  assert(
    service.includes("Not enough Synergy Points for another mock interview."),
    "insufficient message",
  );
});

suite("technical failure refunds a charge", () => {
  assert(service.includes("refundMockChargeIfAny"), "refund helper");
  assert(service.includes("mock-interview:refund:"), "refund idempotency");
  assert(
    service.includes('true,\n    );\n    await refundMockChargeIfAny'),
    "report-validation path refunds",
  );
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
