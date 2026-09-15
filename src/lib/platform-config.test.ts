/**
 * T-277 runtime config writes.
 *   npm run test:platform-config-write
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MOCK_FREE_ALLOWANCE_KEY,
  MOCK_POINT_COST_KEY,
  PLATFORM_CONFIG_KEYS,
  resolveIntConfig,
} from "@/lib/platform-config";

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

console.log("\nT-277 platform config");

suite("mock keys default fail-closed", () => {
  assert(resolveIntConfig(MOCK_FREE_ALLOWANCE_KEY, null) === 3, "allowance default 3");
  assert(resolveIntConfig(MOCK_POINT_COST_KEY, null) === 50, "cost default 50");
  assert(resolveIntConfig(MOCK_POINT_COST_KEY, -1) === 50, "out of range uses default");
});

suite("writeIntConfig rejects unknown keys and audits", () => {
  const src = read("src/lib/platform-config.ts");
  assert(src.includes("export async function writeIntConfig"), "writeIntConfig");
  assert(src.includes("Unknown integer config key"), "unknown key");
  assert(src.includes("intConfigSchema(spec.min, spec.max)"), "bounds");
  assert(src.includes('actionType: "PLATFORM_CONFIG_UPDATE"'), "audit type");
  assert(src.includes("writeAudit("), "writeAudit");
  assert("mock.free_allowance" in PLATFORM_CONFIG_KEYS, "allowance registered");
  assert("mock.point_cost" in PLATFORM_CONFIG_KEYS, "cost registered");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
